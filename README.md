# fund-dashboard —— 双指数场外基金看板

把 `nasdq100/` 和 `sp500/` 两个项目每期的快照，汇成一个**可切换指数**的静态网页。
顶部切指数（纳指100 / 标普500），下面切快照日期，两层筛选，一个 URL。

## 结构

```
fund-dashboard/
  gen_web.js          汇总生成器：扫描各项目 output/，产出 web/data/
  web/
    index.html        单文件看板（指数切换 + 日期切换 + 限购表 + 3 张 ECharts）
    echarts.min.js    从项目里复制的本地 echarts
    data/
      index.json                  指数清单 {indices, default}
      <key>/manifest.json         某指数快照清单 {name, latest, dates[]}
      <key>/<日期>/{rank,results}.json + changes.md
```

指数配置写在 `gen_web.js` 顶部的 `INDICES`（`key` = URL/目录名，`dir` = 项目根）。
要加第三个指数，往那个数组里加一行即可，`index.html` 无需改动。

## 更新与预览

两个项目的 `run_weekly.sh` 末尾都会调 `node ../fund-dashboard/gen_web.js`，
**谁跑都会重建全部指数**，所以任一项目更新后看板都是最新的。也可手动：

```bash
node gen_web.js
cd web && python -m http.server 8080      # 本地预览
```

## 部署

`web/` 是纯静态目录，整个推到 GitHub Pages / Vercel 即可（`web/data/` 是生成产物，git 部署需一并 commit）。

## 说明

- `index.html` 从 `nasdq100/web/index.html` 演进而来，数据加载路径多了一层 `<key>/`；
  `chart2`（效率地图）坐标轴改为按当期数据自适应，兼容不同指数的费率/误差量级。
- 旧的 `nasdq100/web/` 与 `nasdq100/gen_web.js` 已被本目录取代，可删除。
