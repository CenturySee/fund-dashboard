# fund-dashboard —— 双指数场外基金看板

把 `nasdq100/` 和 `sp500/` 两个项目每期的快照，汇成一个**可切换指数**的静态网页。
顶部切指数（纳指100 / 标普500），下面切快照日期，两层筛选，一个 URL。

**功能**：吸顶指数/目录切换 · 本期变化 diff · 限购信息表（状态/份额/搜索/分页，
含「跟踪指数」列区分标准与等权重指数）· 一键导出当前筛选为带格式的 `.xlsx`
（纯前端生成，零依赖）· 三张交互 ECharts（评分榜/效率地图/收益排行）·
自适应横屏竖屏窄屏 · 连续相同限购快照去重 · 核查时间与最近变更日期高亮提示。

## 结构

```
fund-dashboard/
  gen_web.js          汇总生成器：扫描各项目 output/，产出 web/data/
  snapshot-history.js 限购信息比较与连续去重
  cleanup-snapshots.js 原始归档清理（默认预览，--apply 删除）
  scheduled_update.sh 定时更新与部署，输出 scheduled_update.log
  web/
    index.html        单文件看板（指数切换 + 日期切换 + 限购表 + 3 张 ECharts）
    echarts.min.js    从项目里复制的本地 echarts
    data/
      index.json                  指数清单 {indices, default}
      <key>/manifest.json         某指数快照清单 {name, latest, dates[], checkedAt, generated}
      <key>/<日期>/{rank,results}.json + changes.md
```

指数配置写在 `gen_web.js` 顶部的 `INDICES`（`key` = URL/目录名，`dir` = 项目根）。
要加第三个指数，往那个数组里加一行即可，`index.html` 无需改动。

## 更新与预览

纳指100 与标普500 是**两个独立项目**，各自抓自己的基金，需分别更新。两个项目的
`run_weekly.sh` 末尾都会调 `node ../fund-dashboard/gen_web.js`，**谁跑都会重建全部指数**，
所以跑完后看板数据即最新最全。

**一键更新 + 上线：**

```bash
bash update_all.sh        # 刷新纳指100 → 刷新标普500 → 部署，约1分钟后线上生效
```

**只更新某一个指数：** 直接跑对应项目的 `run_weekly.sh`，再 `bash deploy.sh`：

```bash
bash ../nasdq100/run_weekly.sh    # 或 ../sp500/run_weekly.sh
bash deploy.sh                    # 提交推送；数据没变会自动跳过
```

`update_all.sh` / `deploy.sh` 都接受部署目标参数 `[pages|vps|both]`（默认 `pages`，透传）：

```bash
bash deploy.sh vps        # 只发到自建 VPS
bash update_all.sh both   # 刷数据 + 同时发 Pages 和 VPS
```

本地预览：`node gen_web.js && cd web && python -m http.server 8080`

Windows PowerShell 也可用绝对路径启动，避免误打开单指数项目的旧页面：

```powershell
python -m http.server 8081 --directory "C:\xzq\projects\vibe_coding\fund-dashboard\web"
```

浏览器访问 `http://localhost:8081`；端口已占用时换一个端口。

日期下拉列表只收录限购信息发生变化的日期：连续相同的记录保留最早一天，
额度恢复为旧值时仍新增变更节点。比较基金代码、申购状态、可买标记及申购额度，
忽略净值日期、收益、评分和基金排列顺序。
`gen_web.js` 会清理 `web/data/` 中重复的快照，各指数项目 `output/` 中的原始归档仍保留。
页面单独显示最近核查时间；`update_all.sh` 仅为成功更新的指数刷新核查时间。
顶部蓝色提示栏按北京时间显示核查时间，核查时间与最近变更日期均高亮显示。
核查日期晚于最新变更日期时提示“截至本次核查，限购信息暂无变化”；
查看历史快照时显示历史提示，避免将最新核查结论误用于旧数据。
无变化时不发布当天快照，历史收益与评分仍取所保留的变更日数据。
去重逻辑测试：`node --test snapshot-history.test.js`。

清理两个采集项目 `output/` 中的连续重复归档：

```bash
node cleanup-snapshots.js          # 只预览待删除目录
node cleanup-snapshots.js --apply  # 实际删除
```

脚本按自身位置定位同级的 `nasdq100` 和 `sp500`，与运行时的当前目录无关。
仅保留每段相同限购信息最早的归档；额度变化后恢复仍保留。
删除的是整个日期目录（包括当日收益、图表和报告），网页数据及最近核查时间不变。
如果有不完整或损坏的快照，检查会报错并停止。请在更新脚本运行结束后清理。
后续运行采集脚本仍会产生当天归档，可再次执行清理脚本。
测试：`node --test snapshot-history.test.js cleanup-snapshots.test.js`。

本机 Windows 计划任务 `fund-dashboard weekly update` 已设置为周一至周五
北京时间 16:00 执行 `scheduled_update.sh`，依次运行 `update_all.sh`（更新并推送 Pages）
和 `deploy.sh vps`（部署 VPS）。任务保存在 Windows 任务计划程序中，克隆仓库不会自动创建。

## 部署

纯静态站（`web/` 目录，无后端），支持两种发布目标，可单选或双发：

**① GitHub Pages（默认）：** 线上 **https://centurysee.github.io/fund-dashboard/**。
`.github/workflows/pages.yml` 在每次 push 到 `main` 时自动把 `web/` 发布上线——
`deploy.sh` / `update_all.sh` 已封装好 commit+push，日常无需手动操作。
`web/data/` 是生成产物但需一并提交（静态站点靠它取数）。

**② 自建 VPS（`deploy/`）：** nginx 监听非标端口 8443 + Cloudflare Origin Rules 把
443 回源改写到 8443，访客走 `https://fund.imak.top`（URL 不带端口）。完整步骤见
[`deploy/DEPLOY-VPS.md`](deploy/DEPLOY-VPS.md)，nginx 配置见 [`deploy/nginx-fund.imak.top.conf`](deploy/nginx-fund.imak.top.conf)。
VPS 目标可用环境变量覆盖，默认主机为 SSH 别名 `racknerd-65201`，目标目录为 `/var/www/funds`：

```bash
export VPS_HOST=deploy@你的IP
export VPS_DEST=/var/www/funds
bash deploy.sh vps        # 或 both（同时发 Pages）
```

`deploy.sh vps` 使用 `scp -r` 上传完整发布到 `releases/`，完成后切换 `web` 符号链接，无需 reload nginx。
旧发布保留用于回滚，需定期清理；首次迁移现有真实目录时会有短暂切换窗口。MCP 部署见 [deploy/MCP.md](deploy/MCP.md)。

> **部署失败怎么办**：偶尔 Actions 报 `Deployment failed, try again later`（GitHub Pages
> 后端临时故障，即使状态页显示正常）。**别用 `gh run rerun --failed`**——它会重传 artifact
> 导致「两个同名 artifact」越修越乱。正确做法是隔几分钟触发一次全新运行：
> `gh workflow run pages.yml --repo CenturySee/fund-dashboard`，或再 push 一个小改动。

## 说明

- 看板导航中的「MCP / Agent 接入」链接指向 `web/mcp.html`；`web/llms.txt` 提供 JSON 读取步骤和字段语义，随现有静态站一同部署。
- `mcp/` 已实现独立的只读 MCP 服务；本地启动和 VPS 部署见 [deploy/MCP.md](deploy/MCP.md)。远程服务需单独部署，静态 JSON URL 不能作为 MCP server。

- `index.html` 从 `nasdq100/web/index.html` 演进而来，数据加载路径多了一层 `<key>/`；
  `chart2`（效率地图）坐标轴改为按当期数据自适应，兼容不同指数的费率/误差量级。
- 旧的 `nasdq100/web/` 与 `nasdq100/gen_web.js` 已被本目录取代，可删除。
