import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './server.js';
const port = Number(process.env.PORT ?? 3100);
const staleHours = Number(process.env.STALE_HOURS ?? 96);
if (!Number.isInteger(port) || port < 1 || port > 65535 || !Number.isFinite(staleHours) || staleHours <= 0) throw new Error('Invalid PORT or STALE_HOURS');
const dataDir = process.env.DATA_DIR ?? fileURLToPath(new URL('../../web/data', import.meta.url));
const app = createApp(path.resolve(dataDir), {
  token: process.env.MCP_TOKEN || undefined,
  allowedHosts: (process.env.MCP_ALLOWED_HOSTS ?? 'localhost,127.0.0.1').split(',').map(s => s.trim()), staleHours
});
const server = app.listen(port, '127.0.0.1', () => console.log(`Fund MCP listening on http://127.0.0.1:${port}/mcp`));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => { server.close(); });
