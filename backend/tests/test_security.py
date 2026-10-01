import io
import socket
import threading
import unittest
from unittest.mock import MagicMock, patch

from app.safety import (FetchError, MAX_BYTES, PinnedHTTPConnection, PinnedHTTPSConnection,
                        _DeadlineReader, fetch_public_page, normalize_url,
                        parse_page, resolve_public)


HTML = b'<html><title>Real Company</title><meta name="description" content="Public business software"><body>Business workflow software for revenue and sales teams.</body></html>'


class FakeResponse:
    def __init__(self, status=200, headers=None, body=HTML):
        self.status = status
        self.headers = headers if headers is not None else {'Content-Type': 'text/html'}
        self.body = io.BytesIO(body)
        self.closed = False

    def getheader(self, name, default=None):
        return self.headers.get(name, default)

    def read1(self, n):
        return self.body.read(n)

    def close(self):
        self.closed = True


class FakeConnection:
    def __init__(self, response):
        self.response = response
        self.sock = MagicMock()
        self.closed = False
        self.sent = []

    def request(self, *args, **kwargs):
        self.sent.append((args, kwargs))

    def getresponse(self):
        return self.response

    def close(self):
        self.closed = True


class SecurityTest(unittest.TestCase):
    def test_normalize_only_public_web_hosts(self):
        self.assertEqual(normalize_url('COMPANY.COM/about#team'), 'https://company.com/about')
        self.assertEqual(normalize_url('https://company.com:443'), 'https://company.com/')
        self.assertEqual(normalize_url('http://company.com:80/a?b=c'), 'http://company.com/a?b=c')
        for url in ['file:///etc/passwd', 'ftp://company.com', 'http://localhost', 'http://127.0.0.1',
                    'http://127.1', 'http://2130706433', 'http://0x7f000001', 'http://[::1]',
                    'http://user:pass@company.com', 'https://company.com:8443/',
                    'https://metadata.internal/', 'https://company.local/',
                    'https://company.example/', 'https://company.test/', 'http://company.com\\@evil.com',
                    'https://company.com\n/hello', 'http://-bad.com', 'http://a..com', 'http://company.com:bad']:
            with self.subTest(url=url), self.assertRaises(FetchError):
                normalize_url(url)

    def test_dns_rejects_any_private_or_special_answer(self):
        blocked = ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254',
                   '0.0.0.0', '100.64.0.1', '224.0.0.1', '192.0.2.1', '::1', 'fe80::1',
                   'fc00::1', 'fec0::1', '4000::1', '::ffff:8.8.8.8', '64:ff9b::808:808', '2002:0808:0808::1']
        for ip in blocked:
            result = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', (ip, 443))]
            with self.subTest(ip=ip), patch('app.safety.socket.getaddrinfo', return_value=result), self.assertRaises(FetchError):
                resolve_public('company.com', 443)
        mixed = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', (ip, 443)) for ip in ('8.8.8.8', '127.0.0.1')]
        with patch('app.safety.socket.getaddrinfo', return_value=mixed), self.assertRaises(FetchError):
            resolve_public('company.com', 443)

    def test_dns_accepts_public_addresses(self):
        results = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('8.8.8.8', 443)),
                   (socket.AF_INET6, socket.SOCK_STREAM, 6, '', ('2606:4700:4700::1111', 443, 0, 0))]
        with patch('app.safety.socket.getaddrinfo', return_value=results):
            self.assertEqual(resolve_public('company.com', 443), ['8.8.8.8', '2606:4700:4700::1111'])

    def test_dns_timeout_and_resolution_failure(self):
        future = MagicMock()
        future.result.side_effect = TimeoutError()
        with patch('app.safety._DNS_POOL.submit', return_value=future), self.assertRaises(FetchError):
            resolve_public('company.com', 443)
        future.cancel.assert_called_once()
        with patch('app.safety.socket.getaddrinfo', side_effect=socket.gaierror()), self.assertRaises(FetchError):
            resolve_public('company.com', 443)

    def test_connection_is_pinned_without_hostname_reresolution(self):
        sock = MagicMock()
        with patch('app.safety.socket.create_connection', return_value=sock) as create:
            conn = PinnedHTTPConnection('company.com', '8.8.8.8', 80, 4)
            conn.connect()
            create.assert_called_once_with(('8.8.8.8', 80), 4)
            self.assertEqual(conn.host, 'company.com')

    def test_tls_timeout_uses_remaining_absolute_deadline(self):
        sock, context = MagicMock(), MagicMock()
        with patch('app.safety.time.monotonic', return_value=10):
            conn = PinnedHTTPSConnection('company.com', '8.8.8.8', 443, 8)
        with patch('app.safety.socket.create_connection', return_value=sock), patch('app.safety.ssl.create_default_context', return_value=context), patch('app.safety.time.monotonic', return_value=16):
            conn.connect()
        sock.settimeout.assert_called_with(2)
        context.wrap_socket.assert_called_once_with(sock, server_hostname='company.com')

    def test_html_extraction_ignores_active_content(self):
        page = parse_page('https://company.com/', b'<title>Company</title><script>secret malicious script</script><style>bad css</style><body>Public workflow software for sales teams and business organizations.</body>')
        self.assertEqual(page.title, 'Company')
        self.assertNotIn('secret', page.text)
        self.assertNotIn('bad css', page.text)
        with self.assertRaises(FetchError):
            parse_page('https://company.com/', b'<script>All JavaScript</script>')

    def fetch_with(self, responses):
        connections = [FakeConnection(r) for r in responses]
        with patch('app.safety.resolve_public', return_value=['8.8.8.8']) as resolver, \
             patch('app.safety.PinnedHTTPSConnection', side_effect=connections) as factory:
            result = fetch_public_page('https://company.com/')
        return result, connections, resolver, factory

    def test_bounded_fetch_and_headers(self):
        page, connections, resolver, factory = self.fetch_with([FakeResponse()])
        self.assertEqual(page.title, 'Real Company')
        self.assertTrue(connections[0].closed)
        self.assertTrue(connections[0].response.closed)
        self.assertEqual(connections[0].sent[0][1]['headers']['Accept-Encoding'], 'identity')
        self.assertNotIn('Authorization', connections[0].sent[0][1]['headers'])
        self.assertEqual(factory.call_args.args[:3], ('company.com', '8.8.8.8', 443))

    def test_redirect_revalidates_new_host(self):
        page, _, resolver, _ = self.fetch_with([FakeResponse(302, {'Location': 'https://other-company.com/new'}), FakeResponse()])
        self.assertEqual(page.url, 'https://other-company.com/new')
        self.assertEqual([c.args[0] for c in resolver.call_args_list], ['company.com', 'other-company.com'])

    def test_redirect_to_private_host_is_blocked(self):
        for redirect in ['http://127.0.0.1/', 'http://localhost/', 'https://company.internal/', 'file:///etc/passwd']:
            with self.subTest(redirect=redirect), self.assertRaises(FetchError):
                self.fetch_with([FakeResponse(302, {'Location': redirect})])
        connection = FakeConnection(FakeResponse(302, {'Location': 'https://looks-public.com/'}))
        with patch('app.safety.resolve_public', side_effect=[['8.8.8.8'], FetchError('private address')]), \
             patch('app.safety.PinnedHTTPSConnection', return_value=connection), self.assertRaises(FetchError):
            fetch_public_page('https://company.com/')

    def test_redirect_limit(self):
        with self.assertRaises(FetchError):
            self.fetch_with([FakeResponse(302, {'Location': '/again'}) for _ in range(4)])

    def test_large_mime_compressed_error_response_rejected(self):
        bad = [FakeResponse(headers={'Content-Type': 'text/html', 'Content-Length': str(MAX_BYTES+1)}),
               FakeResponse(headers={'Content-Type': 'text/html'}, body=b'x' * (MAX_BYTES+1)),
               FakeResponse(headers={'Content-Type': 'text/html', 'Content-Encoding': 'gzip'}),
               FakeResponse(headers={'Content-Type': 'application/json'}),
               FakeResponse(headers={'Content-Type': 'text/html', 'Content-Length': 'invalid'}),
               FakeResponse(status=403)]
        for response in bad:
            with self.subTest(headers=response.headers, status=response.status), self.assertRaises(FetchError):
                self.fetch_with([response])

    def test_connection_failure_is_safe(self):
        connection = FakeConnection(FakeResponse())
        connection.getresponse = MagicMock(side_effect=OSError('internal socket detail'))
        with patch('app.safety.resolve_public', return_value=['8.8.8.8']), patch('app.safety.PinnedHTTPSConnection', return_value=connection):
            with self.assertRaises(FetchError) as context:
                fetch_public_page('https://company.com/')
            self.assertNotIn('internal socket', str(context.exception))
            self.assertTrue(connection.closed)

    def test_real_http_parser_with_pinned_socket_and_connection_close(self):
        client, server = socket.socketpair()
        def serve():
            try:
                server.recv(4096)
                server.sendall(b'HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nConnection: close\r\nContent-Length: ' + str(len(HTML)).encode() + b'\r\n\r\n' + HTML)
            finally:
                server.close()
        thread = threading.Thread(target=serve)
        thread.start()
        try:
            with patch('app.safety.resolve_public', return_value=['8.8.8.8']), patch('app.safety.socket.create_connection', return_value=client):
                page = fetch_public_page('http://company.com/')
            self.assertEqual(page.title, 'Real Company')
        finally:
            client.close()
            thread.join(timeout=2)

    def test_deadline_reader_blocks_slow_header_trickle(self):
        raw, sock = MagicMock(), MagicMock()
        reader = _DeadlineReader(raw, sock, 10)
        with patch('app.safety.time.monotonic', return_value=11), self.assertRaises(TimeoutError):
            reader.readinto(bytearray(10))
        raw.readinto.assert_not_called()
        with patch('app.safety.time.monotonic', return_value=8):
            reader.readinto(bytearray(10))
        sock.settimeout.assert_called_with(2)


if __name__ == '__main__':
    unittest.main()
