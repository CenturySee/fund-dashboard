import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { inputSchema, outputSchema, queryLimits } from './data.js';

export function createApp(dataDir: string, options: { token?: string; allowedHosts?: string[]; staleHours?: number } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
  app.use('/mcp', (req, res, next) => {
    if (!options.allowedHosts?.includes(req.hostname)) { res.status(403).json({ error: 'Host not allowed' }); return; }
    // MCP clients do not need a browser origin. Same-host browser requests are allowed.
    if (req.headers.origin) {
      try { if (new URL(req.headers.origin).host !== req.headers.host) throw new Error('origin'); }
      catch { res.status(403).json({ error: 'Origin not allowed' }); return; }
    }
    if (options.token && req.headers.authorization !== `Bearer ${options.token}`) {
      res.status(401).json({ error: 'Bearer token required' }); return;
    }
    next();
  }, express.json({ limit: '64kb' }));
  app.post('/mcp', async (req, res) => {
    const server = new McpServer({ name: 'fund-dashboard-mcp-server', version: '1.0.0' });
    server.registerTool('get_latest_limits', {
      title: '查询基金最新限购信息',
      description: '查询纳指100、标普500基金限购快照。支持筛选与分页；逐指数返回核查时间、变更日期和过期标记。额度为原始字符串，未知不等于不限额。',
      inputSchema: inputSchema.shape, outputSchema: outputSchema.shape,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    }, async (input) => {
      try {
        const output = await queryLimits(dataDir, input, options.staleHours);
        return { content: [{ type: 'text' as const, text: JSON.stringify(output) }], structuredContent: output };
      } catch (error) {
        console.error('Limit query failed:', error);
        const message = error instanceof Error && error.message.startsWith('未知指数') ? error.message : '数据读取失败，请稍后重试或检查数据部署、manifest 和快照文件。';
        return { isError: true, content: [{ type: 'text' as const, text: message }] };
      }
    });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void transport.close(); void server.close(); });
    try { await server.connect(transport); await transport.handleRequest(req, res, req.body); }
    catch (error) {
      console.error('MCP request failed:', error);
      if (!res.headersSent) res.status(500).json({ error: 'MCP request failed' });
    }
  });
  app.all('/mcp', (_req, res) => { res.set('Allow', 'POST').status(405).end(); });
  return app;
}
