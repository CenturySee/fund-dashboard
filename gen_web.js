// gen_web.js —— 双指数场外基金看板：把各项目 output/ 下的快照整理成静态网页数据
// 用法：node gen_web.js   （由各项目 run_weekly.sh 末尾调用，谁跑都重建全部指数）
// 产出：
//   web/data/index.json                       指数清单 {indices:[{key,name,latest,count}], default, generated}
//   web/data/<key>/manifest.json              某指数的快照清单 {latest, dates[], name, generated}
//   web/data/<key>/<日期>/{rank,results,changes}.json/.md
//   web/echarts.min.js                        复用本地 echarts，免联网 CDN
const fs = require('fs');
const path = require('path');
const { collapse } = require('./snapshot-history');

const ROOT = __dirname;
const WEB = path.join(ROOT, 'web');
const WDATA = path.join(WEB, 'data');

// —— 指数配置：key 用作 URL/目录名，dir 指向各自的项目根 ——
const INDICES = [
  { key: 'nasdq100', name: '纳指100', dir: path.join(ROOT, '..', 'nasdq100') },
  { key: 'sp500',    name: '标普500', dir: path.join(ROOT, '..', 'sp500') },
];

fs.mkdirSync(WDATA, { recursive: true });

// echarts：从任一存在的项目里取一份放到 web/ 根
for (const ix of INDICES) {
  const src = path.join(ix.dir, 'echarts.min.js');
  if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(WEB, 'echarts.min.js')); break; }
}

const isDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d);
const copyIf = (src, dst) => { if (fs.existsSync(src)) { fs.copyFileSync(src, dst); return true; } return false; };

const indexEntries = [];
for (const ix of INDICES) {
  const outDir = path.join(ix.dir, 'output');
  if (!fs.existsSync(outDir)) { console.warn(`  ⚠ 跳过 ${ix.key}：找不到 ${outDir}`); continue; }

  const dates = fs.readdirSync(outDir)
    .filter(d => isDate(d) && fs.statSync(path.join(outDir, d)).isDirectory())
    .sort().reverse();                 // 最新在前

  const idxData = path.join(WDATA, ix.key);
  const manifestPath = path.join(idxData, 'manifest.json');
  const previous = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  const snapshots = dates.flatMap(date => {
    const dir = path.join(outDir, date);
    if (!fs.existsSync(path.join(dir, 'rank.json')) || !fs.existsSync(path.join(dir, 'results.json'))) {
      console.warn(`跳过 ${ix.key}/${date}：缺 rank.json/results.json`);
      return [];
    }
    const results = JSON.parse(fs.readFileSync(path.join(dir, 'results.json'), 'utf8'));
    if (!Array.isArray(results) || !results.length) throw new Error(`${ix.key}/${date} 数据为空或格式错误`);
    return [{ date, results }];
  });
  const kept = collapse(snapshots).map(s => s.date).reverse();
  if (!kept.length) { console.warn(`${ix.key} 无有效快照`); continue; }
  // 采用抓取时间，而非页面生成时间。
  const sourceTime = fs.statSync(path.join(outDir, snapshots[0].date, 'results.json')).mtime.toISOString();
  const checkedAt = process.argv.includes(`--checked=${ix.key}`) ? new Date().toISOString()
    : [previous.checkedAt || previous.generated || '', sourceTime].sort().pop();
  for (const d of kept) {
    const sdir = path.join(outDir, d);
    const ddir = path.join(idxData, d);
    fs.mkdirSync(ddir, { recursive: true });
    copyIf(path.join(sdir, 'rank.json'), path.join(ddir, 'rank.json'));
    copyIf(path.join(sdir, 'results.json'), path.join(ddir, 'results.json'));
    // 中文文件名在静态托管上会有 URL 编码坑，统一改成 changes.md
    const hasDiff = copyIf(path.join(sdir, '本周变化.md'), path.join(ddir, 'changes.md'));
    if (!hasDiff) fs.writeFileSync(path.join(ddir, 'changes.md'), '# 本周变化\n\n（该期无对比数据）\n');
  }

  if (!kept.length) { console.warn(`  ⚠ ${ix.key} 无有效快照，未收录`); continue; }

  // 网页仅发布变更节点，原始抓取归档保留在各指数项目的 output/。
  for (const d of fs.readdirSync(idxData).filter(isDate)) {
    if (!kept.includes(d)) {
      const target = path.resolve(idxData, d);
      if (path.dirname(target) !== path.resolve(idxData)) throw new Error('无效的快照路径');
      fs.rmSync(target, { recursive: true, force: true });
    }
  }
  fs.mkdirSync(idxData, { recursive: true });
  fs.writeFileSync(path.join(idxData, 'manifest.json'), JSON.stringify({
    name: ix.name, latest: kept[0], dates: kept, checkedAt, generated: new Date().toISOString(),
  }, null, 2));
  indexEntries.push({ key: ix.key, name: ix.name, latest: kept[0], count: kept.length });
  console.log(`  ✓ ${ix.name} (${ix.key})：${kept.length} 期，最新 ${kept[0]}`);
}

if (!indexEntries.length) { console.error('没有任何指数有快照，先跑各项目的 run_weekly.sh'); process.exit(1); }

fs.writeFileSync(path.join(WDATA, 'index.json'), JSON.stringify({
  indices: indexEntries,
  default: indexEntries[0].key,
  generated: new Date().toISOString(),
}, null, 2));

console.log(`web/ 已更新：${indexEntries.length} 个指数`);
console.log('本地预览： (cd web && python -m http.server 8080)  或部署 web/ 目录');
