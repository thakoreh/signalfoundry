"""Local readiness only; never prints configuration or credentials."""
import json
from urllib.request import ProxyHandler, build_opener

with build_opener(ProxyHandler({})).open('http://127.0.0.1:8001/readyz', timeout=3) as response:
    if response.status != 200 or json.load(response) != {'status': 'ready'}:
        raise SystemExit('Worker is not ready')
