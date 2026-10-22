const assert = require('node:assert/strict');
const { test } = require('node:test');
const guard = require.resolve('./fixture_loopback_fetch.cjs');

async function guarded(check) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async function (...args) {
    calls.push({ receiver: this, args });
    return new Response('fictional local fixture');
  };
  delete require.cache[guard];
  try { require(guard); await check(calls); }
  finally { globalThis.fetch = original; delete require.cache[guard]; }
}

test('offline fixture rejects external fetches before dispatch, including the framework updater', async () => {
  await guarded(async calls => {
    for (const input of [
      'https://registry.npmjs.org/-/package/next/dist-tags',
      new URL('https://outside.example/path'),
      new Request('https://outside.example/request'),
      'http://127.0.0.1.outside.example/', 'http://192.168.1.1/',
      'http://localhost.outside.example/',
    ]) await assert.rejects(globalThis.fetch(input), /loopback HTTP/);
    assert.equal(calls.length, 0);
  });
});
test('offline fixture rejects credentials, unsupported schemes and malformed inputs without echoing them', async () => {
  await guarded(async calls => {
    for (const input of ['http://fictional:private@127.0.0.1/', 'file:///fixture', 'data:text/plain,fixture', 'invalid', {}]) {
      await assert.rejects(globalThis.fetch(input), error => {
        assert.equal(error.message, 'Offline integration fixture permits loopback HTTP fetch only.');
        return true;
      });
    }
    assert.equal(calls.length, 0);
  });
});
test('offline fixture preserves local requests, options, abort signals and receiver', async () => {
  await guarded(async calls => {
    const controller = new AbortController();
    const options = { signal: controller.signal, headers: { 'X-Fixture': 'fictional' } };
    const receiver = {};
    for (const input of ['http://127.0.0.1:49152/api/health', new URL('http://localhost:3001/readyz'), new Request('http://[::1]:3001/api/health')]) {
      const response = await globalThis.fetch.call(receiver, input, options);
      assert.equal(await response.text(), 'fictional local fixture');
      assert.deepEqual(calls.at(-1), { receiver, args: [input, options] });
    }
    assert.equal(calls.length, 3);
  });
});
