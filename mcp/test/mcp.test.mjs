import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createApp } from '../dist/server.js';

test('MCP discovery, query, pagination, live reload, validation and access controls', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'fund-mcp-'));
  const folder = path.join(root, 'nasdq100', '2026-10-01');
  await mkdir(folder, { recursive: true });
  const save = (file, data) => writeFile(path.join(root, file), JSON.stringify(data));
  await save('index.json', { indices: [{ key: 'nasdq100', name: '纳指100' }] });
  await save('nasdq100/manifest.json', { latest: '2026-10-01', checkedAt: '2026-10-01T00:00:00.000Z' });
  await save('nasdq100/2026-10-01/results.json', [
    { code: '000001', name: '暂停基金', buy_status: '暂停申购', buyable: true, maxsg: '100' },
    { code: '000002', name: '可买基金', buyable: true },
    { code: '000003', name: '未知基金' }
  ]);
  const http = createApp(root, { allowedHosts: ['127.0.0.1'], token: 'test-secret' }).listen(0, '127.0.0.1');
  await new Promise(resolve => http.once('listening', resolve));
  const url = new URL(`http://127.0.0.1:${http.address().port}/mcp`);
  const client = new Client({ name: 'integration-test', version: '1.0.0' });
  try {
    assert.equal((await fetch(url, { method: 'POST' })).status, 401);
    assert.equal((await fetch(url, { method: 'POST', headers: { Origin: 'https://evil.example' } })).status, 403);
    await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: 'Bearer test-secret' } } }));
    const tools = await client.listTools();
    assert.equal(tools.tools[0].name, 'get_latest_limits');
    assert.ok(tools.tools[0].outputSchema);
    const call = args => client.callTool({ name: 'get_latest_limits', arguments: args });
    const first = (await call({ limit: 1 })).structuredContent;
    assert.equal(first.total, 3);
    assert.equal(first.nextOffset, 1);
    assert.equal(first.funds[0].code, '000001');
    assert.equal(first.funds[0].effectiveBuyable, false);
    assert.equal(first.funds[0].statusConflict, true);
    assert.equal(first.indices[0].stale, true);
    const filtered = (await call({ buyable: true })).structuredContent;
    assert.equal(filtered.total, 1);
    assert.equal(filtered.funds[0].code, '000002');
    assert.equal((await call({ offset: 3 })).structuredContent.funds.length, 0);
    assert.equal((await call({ code: '999999' })).structuredContent.total, 0);
    assert.equal((await call({ index: 'unknown' })).isError, true);
    assert.equal((await call({ limit: 101 })).isError, true);
    await save('nasdq100/manifest.json', { latest: '2026-10-01' });
    assert.equal((await call({})).structuredContent.indices[0].checkedAt, null);
    await save('nasdq100/2026-10-01/results.json', [{ code: '000004', name: '更新基金' }]);
    assert.equal((await call({})).structuredContent.funds[0].code, '000004');
    await writeFile(path.join(folder, 'results.json'), '{broken');
    assert.equal((await call({})).isError, true);
  } finally {
    await client.close();
    await new Promise(resolve => http.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
