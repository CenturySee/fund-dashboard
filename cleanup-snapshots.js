// node cleanup-snapshots.js          预览
// node cleanup-snapshots.js --apply  删除连续重复的原始归档
const fs = require('node:fs');
const path = require('node:path');
const { signature } = require('./snapshot-history');

function planCleanup(output) {
  output = path.resolve(output);
  if (fs.lstatSync(output).isSymbolicLink()) throw new Error(`拒绝清理链接目录：${output}`);
  const dates = fs.readdirSync(output).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const keep = [], remove = [];
  let previous;
  for (const date of dates) {
    const dir = path.resolve(output, date);
    const stat = fs.lstatSync(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`快照目录无效：${dir}`);
    for (const name of ['results.json', 'rank.json']) {
      const file = path.join(dir, name);
      if (!fs.lstatSync(file).isFile() || fs.lstatSync(file).isSymbolicLink()) {
        throw new Error(`快照文件无效：${file}`);
      }
    }
    const rows = JSON.parse(fs.readFileSync(path.join(dir, 'results.json'), 'utf8'));
    if (!Array.isArray(rows) || !rows.length || rows.some(r => !r || !r.code || typeof r.buy_status !== 'string')) {
      throw new Error(`快照数据不完整：${dir}`);
    }
    const rank = JSON.parse(fs.readFileSync(path.join(dir, 'rank.json'), 'utf8'));
    if (!Array.isArray(rank)) throw new Error(`rank.json 格式错误：${dir}`);
    const current = signature(rows);
    if (current === previous) remove.push(date);
    else keep.push(date);
    previous = current;
  }
  return { output, keep, remove };
}

function applyCleanup(plan) {
  // 删除前重新读取，防止预览后数据变化或调用者传入错误路径。
  const current = planCleanup(plan.output);
  if (JSON.stringify(current) !== JSON.stringify(plan)) throw new Error('归档已变化，请重新预览');
  const root = fs.realpathSync(plan.output);
  for (const date of plan.remove) {
    const target = path.resolve(plan.output, date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || path.dirname(target) !== plan.output
      || path.dirname(fs.realpathSync(target)) !== root || fs.lstatSync(target).isSymbolicLink()) {
      throw new Error(`拒绝删除越界路径：${target}`);
    }
    fs.rmSync(target, { recursive: true });
  }
}

function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--apply')) throw new Error('用法：node cleanup-snapshots.js [--apply]');
  const apply = args.includes('--apply');
  // 两个项目都检查成功后才开始删除；不跳过损坏或不完整的快照。
  const plans = ['nasdq100', 'sp500'].map(key => ({
    key, plan: planCleanup(path.join(__dirname, '..', key, 'output')),
  }));
  for (const { key, plan } of plans) {
    console.log(`${key}：保留 ${plan.keep.length} 个，${apply ? '删除' : '待删除'} ${plan.remove.length} 个`);
    for (const date of plan.remove) console.log(`  ${path.join(plan.output, date)}`);
  }
  if (apply) {
    for (const { plan } of plans) applyCleanup(plan);
    console.log('清理完成。网页数据与最近核查时间保持不变。');
  } else console.log('仅预览，未删除文件。确认后执行：node cleanup-snapshots.js --apply');
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { planCleanup, applyCleanup };
