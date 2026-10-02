"""Bounded public-web reader with DNS pinning and redirect validation.

Never uses environment proxies, cookies, authentication, JavaScript, or subresources.
HTTP is supported for public sites; HTTPS certificate checks are never disabled.
"""
from __future__ import annotations

import concurrent.futures
import http.client
import ipaddress
import io
import re
import socket
import ssl
import threading
import time
from dataclasses import dataclass
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, urlunsplit

MAX_BYTES = 512_000
MAX_TEXT = 24_000
MAX_REDIRECTS = 3
FETCH_TIMEOUT = 8.0
DNS_TIMEOUT = 2.0
# Match the worker's admitted 2 jobs x 4 domain lanes; still never queue behind
# a stuck OS resolver. WorkerSettings validates any programmatic concurrency.
DNS_CAPACITY = 8
_DNS_POOL = concurrent.futures.ThreadPoolExecutor(max_workers=DNS_CAPACITY, thread_name_prefix='public-dns')
# OS resolver calls cannot always be interrupted. Never queue behind stalled DNS.
_DNS_SLOTS = threading.BoundedSemaphore(DNS_CAPACITY)

# Some cloud control/metadata services use addresses classified as globally
# routable by ipaddress. Deny these exact endpoints, not neighboring public IPs.
# Azure WireServer: https://learn.microsoft.com/en-us/azure/virtual-network/what-is-ip-address-168-63-129-16
# Oracle Cloud Machine: https://docs.oracle.com/cloud-machine/latest/stcomputecs/ELUSE/GUID-D0905B84-1B6D-4058-BA3D-4F7385B062C1.htm
# Oracle is already non-global in newer Python; explicit denial is version-safe.
_PLATFORM_SERVICE_IPS = frozenset(map(ipaddress.ip_address, ('168.63.129.16', '192.0.0.192')))


class FetchError(ValueError):
    """A safe, actionable error that contains no internal address or response body."""


def normalize_url(raw: str) -> str:
    if not isinstance(raw, str) or not raw or len(raw) > 2048:
        raise FetchError('Enter a public HTTP(S) business website, up to 2048 characters')
    raw = raw.strip()
    if any(ord(c) < 33 for c in raw) or '\\' in raw:
        raise FetchError('Website URLs cannot contain whitespace, control characters, or backslashes')
    if '://' not in raw:
        raw = 'https://' + raw
    try:
        p = urlsplit(raw)
        if p.scheme.lower() not in ('http', 'https') or not p.hostname or p.username is not None or p.password is not None:
            raise FetchError('Only public HTTP(S) websites without credentials are allowed')
        host = p.hostname.rstrip('.').encode('idna').decode('ascii').lower()
        if p.port not in (None, 80 if p.scheme.lower() == 'http' else 443):
            raise FetchError('Only standard HTTP and HTTPS ports are allowed')
    except (ValueError, UnicodeError) as exc:
        if isinstance(exc, FetchError):
            raise
        raise FetchError('Enter a valid public business website') from exc
    # Require a real DNS hostname. Reject alternate numeric-IP encodings too.
    if (len(host) > 253 or '.' not in host or
            not re.fullmatch(r'[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?', host) or
            any(not x or len(x) > 63 or x.startswith('-') or x.endswith('-') for x in host.split('.')) or
            host.split('.')[-1].isdigit() or re.fullmatch(r'(?:0x[0-9a-f]+|[0-9]+)', host)):
        raise FetchError('Use a public business hostname rather than a local host or IP address')
    blocked = ('localhost', 'local', 'internal', 'test', 'invalid', 'example', 'onion', 'home', 'lan')
    if any(host == suffix or host.endswith('.' + suffix) for suffix in blocked):
        raise FetchError('Local, private, and reserved demo domains cannot be fetched')
    return urlunsplit((p.scheme.lower(), host, p.path or '/', p.query, ''))


def resolve_public(host: str, port: int, timeout: float = DNS_TIMEOUT) -> list[str]:
    if not _DNS_SLOTS.acquire(blocking=False):
        raise FetchError('Website DNS capacity is busy; try again later')
    try:
        future = _DNS_POOL.submit(socket.getaddrinfo, host, port, type=socket.SOCK_STREAM)
    except Exception:
        _DNS_SLOTS.release()
        raise
    future.add_done_callback(lambda _: _DNS_SLOTS.release())
    try:
        infos = future.result(timeout=max(0.01, timeout))
    except concurrent.futures.TimeoutError as exc:
        future.cancel()
        raise FetchError('Website DNS lookup timed out; try again or use another public domain') from exc
    except (socket.gaierror, OSError) as exc:
        raise FetchError('The website hostname could not be resolved') from exc
    addresses = list(dict.fromkeys(info[4][0] for info in infos))
    if not addresses:
        raise FetchError('The website hostname has no usable public address')
    for value in addresses:
        try:
            address = ipaddress.ip_address(value)
        except ValueError as exc:
            raise FetchError('The website resolved to an invalid address') from exc
        # Reject the entire answer if even one address is non-public. Also reject
        # IPv4-mapped and translation/tunnel ranges to avoid cross-family bypasses.
        if (address in _PLATFORM_SERVICE_IPS or not address.is_global or address.is_multicast or address.is_reserved or
                (isinstance(address, ipaddress.IPv6Address) and
                 (address.is_site_local or address.ipv4_mapped or address.sixtofour or address.teredo or
                  address in ipaddress.ip_network('64:ff9b::/96') or
                  address in ipaddress.ip_network('64:ff9b:1::/48')))):
            raise FetchError('The website resolves to a private or restricted network address')
    return addresses


class _DeadlineReader(io.RawIOBase):
    def __init__(self, raw, sock, deadline):
        self.raw, self.sock, self.deadline = raw, sock, deadline

    def readable(self):
        return True

    def readinto(self, buffer):
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError('Website deadline reached')
        self.sock.settimeout(remaining)
        return self.raw.readinto(buffer)

    def close(self):
        try:
            self.raw.close()
        finally:
            super().close()


class _DeadlineSocket:
    def __init__(self, sock, deadline):
        self.sock, self.deadline = sock, deadline

    def makefile(self, mode, buffering=None):
        # The raw socket file preserves the socket lifetime if HTTPConnection
        # closes its own reference after a Connection: close response.
        raw = self.sock.makefile(mode, buffering=0)
        return io.BufferedReader(_DeadlineReader(raw, self.sock, self.deadline))

    def sendall(self, data, *args):
        remaining = self.deadline - time.monotonic()
        if remaining <= 0:
            raise TimeoutError('Website deadline reached')
        self.sock.settimeout(remaining)
        return self.sock.sendall(data, *args)

    def __getattr__(self, name):
        return getattr(self.sock, name)


class PinnedHTTPConnection(http.client.HTTPConnection):
    def __init__(self, host, ip, port, timeout):
        super().__init__(host, port=port, timeout=timeout)
        self._pinned_ip = ip
        self._deadline = time.monotonic() + timeout

    def connect(self):
        self.sock = _DeadlineSocket(socket.create_connection((self._pinned_ip, self.port), self.timeout), self._deadline)


class PinnedHTTPSConnection(PinnedHTTPConnection):
    def connect(self):
        super().connect()
        try:
            remaining = self._deadline - time.monotonic()
            if remaining <= 0:
                raise TimeoutError('Website deadline reached')
            self.sock.settimeout(remaining)
            self.sock = _DeadlineSocket(ssl.create_default_context().wrap_socket(self.sock.sock, server_hostname=self.host), self._deadline)
        except Exception:
            self.close()
            raise


class PageParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.title_parts = []
        self.hidden_depth = 0
        self.in_title = False
        self.description = ''

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'noscript', 'template', 'svg'):
            self.hidden_depth += 1
        if tag == 'title':
            self.in_title = True
        data = dict(attrs)
        if tag == 'meta' and data.get('name', '').lower() == 'description':
            self.description = data.get('content', '')[:1500]

    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'noscript', 'template', 'svg'):
            self.hidden_depth = max(0, self.hidden_depth - 1)
        if tag == 'title':
            self.in_title = False

    def handle_data(self, data):
        if self.hidden_depth:
            return
        value = re.sub(r'\s+', ' ', ''.join(c for c in data if ord(c) >= 32 or c.isspace())).strip()
        if value:
            self.parts.append(value)
            if self.in_title:
                self.title_parts.append(value)


@dataclass(frozen=True)
class Page:
    url: str
    title: str
    description: str
    text: str


def parse_page(url: str, body: bytes, charset: str = 'utf-8') -> Page:
    try:
        html = body.decode(charset, errors='replace')
    except LookupError:
        html = body.decode('utf-8', errors='replace')
    parser = PageParser()
    try:
        parser.feed(html)
    except Exception as exc:
        raise FetchError('The website did not return readable HTML') from exc
    text = ' '.join(parser.parts)[:MAX_TEXT]
    if len(text) < 40:
        raise FetchError('The website has too little readable text; it may require JavaScript or sign-in')
    return Page(url, ' '.join(parser.title_parts)[:240] or urlsplit(url).hostname,
                re.sub(r'\s+', ' ', parser.description).strip()[:1500], text)


def fetch_public_page(raw: str) -> Page:
    url = normalize_url(raw)
    deadline = time.monotonic() + FETCH_TIMEOUT
    for redirect in range(MAX_REDIRECTS + 1):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise FetchError('Website request timed out; try again or choose another domain')
        p = urlsplit(url)
        port = 443 if p.scheme == 'https' else 80
        ip = resolve_public(p.hostname, port, min(DNS_TIMEOUT, remaining))[0]
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise FetchError('Website request timed out; try again or choose another domain')
        connection_type = PinnedHTTPSConnection if p.scheme == 'https' else PinnedHTTPConnection
        connection = connection_type(p.hostname, ip, port, remaining)
        response = None
        try:
            target = p.path or '/'
            if p.query:
                target += '?' + p.query
            connection.request('GET', target, headers={
                'User-Agent': 'SignalFoundryLocalDemo/0.1 (public-business-research)',
                'Accept': 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity',
                'Connection': 'close',
            })
            response = connection.getresponse()
            if response.status in (301, 302, 303, 307, 308):
                location = response.getheader('Location')
                if not location or redirect == MAX_REDIRECTS:
                    raise FetchError('The website redirected too many times or returned an invalid redirect')
                url = normalize_url(urljoin(url, location))
                continue
            if response.status != 200:
                raise FetchError(f'The website returned HTTP {response.status}; try another public page')
            content_type = response.getheader('Content-Type', '').lower()
            if content_type.split(';', 1)[0].strip() not in ('text/html', 'application/xhtml+xml'):
                raise FetchError('The website must return an HTML page')
            if response.getheader('Content-Encoding', 'identity').lower() not in ('identity', ''):
                raise FetchError('Compressed website responses are not supported safely in this demo')
            length = response.getheader('Content-Length')
            if length:
                try:
                    if int(length) < 0 or int(length) > MAX_BYTES:
                        raise FetchError('The website response exceeds the 512 KB research limit')
                except ValueError as exc:
                    if isinstance(exc, FetchError):
                        raise
                    raise FetchError('The website returned an invalid response length') from exc
            chunks, size = [], 0
            while True:
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    raise FetchError('Website request timed out; try again or choose another domain')
                if connection.sock:
                    connection.sock.settimeout(remaining)
                # read1 returns after one underlying read: an overall deadline
                # cannot be bypassed by a server trickling a large fixed read.
                chunk = response.read1(min(16384, MAX_BYTES + 1 - size))
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_BYTES:
                    raise FetchError('The website response exceeds the 512 KB research limit')
                chunks.append(chunk)
            charset_match = re.search(r'charset=["\']?([a-zA-Z0-9_-]+)', content_type)
            return parse_page(url, b''.join(chunks), charset_match.group(1) if charset_match else 'utf-8')
        except FetchError:
            raise
        except (OSError, http.client.HTTPException, UnicodeError) as exc:
            raise FetchError('The public website could not be fetched securely; check the URL or try another site') from exc
        finally:
            if response is not None:
                response.close()
            connection.close()
    raise FetchError('The website could not be fetched')
