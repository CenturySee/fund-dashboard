import { readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

const key = z.string().regex(/^[a-zA-Z0-9_-]+$/);
const catalogSchema = z.object({ indices: z.array(z.object({ key, name: z.string() })).min(1) });
const manifestSchema = z.object({ latest: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), checkedAt: z.string().datetime().optional() });
const rowSchema = z.object({
  code: z.string(), name: z.string(), buy_status: z.string().optional(),
  sgzt: z.string().optional(), buyable: z.boolean().optional(),
  daily_limit: z.string().optional(), minsg: z.string().optional(),
  maxsg: z.string().optional(), apply: z.string().optional()
});
export const inputSchema = z.object({
  index: key.optional().describe('指数 key：nasdq100 或 sp500；省略时查询全部'),
  code: z.string().regex(/^\d{6}$/).optional().describe('六位基金代码，保留前导零'),
  buyable: z.boolean().optional().describe('按可买状态筛选；未知状态不匹配'),
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(100).default(30)
}).strict();
export const outputSchema = z.object({
  queriedAt: z.string(), total: z.number(), offset: z.number(), nextOffset: z.number().nullable(),
  indices: z.array(z.object({ key: z.string(), name: z.string(), checkedAt: z.string().nullable(),
    lastChangedDate: z.string(), stale: z.boolean().nullable(), source: z.string() })),
  funds: z.array(rowSchema.extend({ index: z.string(), effectiveBuyable: z.boolean().nullable(), statusConflict: z.boolean() })),
  notes: z.array(z.string())
});
export async function queryLimits(root: string, input: z.infer<typeof inputSchema>, staleHours = 96) {
  // Pin a deployed release for the whole query, even if web symlink switches.
  root = await realpath(root);
  const json = async (file: string) => JSON.parse(await readFile(path.join(root, file), 'utf8'));
  const catalog = catalogSchema.parse(await json('index.json'));
  const selected = catalog.indices.filter(i => !input.index || i.key === input.index);
  if (!selected.length) throw new Error(`未知指数。可用 key：${catalog.indices.map(i => i.key).join(', ')}`);
  const now = Date.now();
  const snapshots = await Promise.all(selected.map(async i => {
    const manifest = manifestSchema.parse(await json(`${i.key}/manifest.json`));
    const source = `data/${i.key}/${manifest.latest}/results.json`;
    const rows = z.array(rowSchema).min(1).parse(await json(source.slice(5)));
    return {
      meta: { ...i, checkedAt: manifest.checkedAt ?? null, lastChangedDate: manifest.latest,
        stale: manifest.checkedAt ? now - Date.parse(manifest.checkedAt) > staleHours * 3600000 : null, source },
      funds: rows.map(row => {
        const paused = /暂停|停止|封闭/.test(`${row.buy_status ?? ''} ${row.sgzt ?? ''}`);
        return { ...row, index: i.key, effectiveBuyable: paused ? false : row.buyable ?? null,
          statusConflict: paused && row.buyable === true };
      })
    };
  }));
  const funds = snapshots.flatMap(s => s.funds).filter(r =>
    (!input.code || r.code === input.code) && (input.buyable === undefined || r.effectiveBuyable === input.buyable)
  ).sort((a, b) => a.index.localeCompare(b.index) || a.code.localeCompare(b.code));
  const end = input.offset + input.limit;
  return { queriedAt: new Date(now).toISOString(), total: funds.length, offset: input.offset,
    nextOffset: end < funds.length ? end : null, indices: snapshots.map(s => s.meta),
    funds: funds.slice(input.offset, end), notes: [
      `定时快照，非实时；stale 表示距核查超过 ${staleHours} 小时，核查时间未知时为 null。`,
      'lastChangedDate 为最近变化日期。额度保留原始字符串；空值不代表零或不限额。',
      'effectiveBuyable 优先尊重暂停状态；statusConflict 表示暂停状态与可买标记冲突。',
      'source 为相对于看板目录的数据路径。分页期间数据可能更新，请核对核查时间。'
    ] };
}
