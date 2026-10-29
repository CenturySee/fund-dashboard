# MCP 服务运行与部署

服务复用 web/data，提供 get_latest_limits，只读查询。使用官方 TypeScript SDK，Node.js 22 或更高版本，Streamable HTTP，无会话状态。未实现 OAuth；可公开只读访问或通过 MCP_TOKEN 设置 Bearer 令牌。

## 本地验证

```powershell
cd mcp
npm ci
npm test
npm start
```

客户端连接 http://127.0.0.1:3100/mcp。默认只监听回环地址；无须部署即可本地使用。默认数据目录为仓库 web/data。环境变量：PORT（3100）、DATA_DIR、MCP_ALLOWED_HOSTS（逗号分隔主机名）、STALE_HOURS（96）、MCP_TOKEN（可选）。

## VPS 首次安装

服务器需具备 systemd、nginx、curl、tar、xz 和 sha256sum。本地需要 Node.js 22+。部署脚本会从 Node.js 官方下载并校验 SHA-256，在 /opt/fund-mcp/node 安装专用 Node.js 22.23.4，不修改系统 Node/npm。将本目录 fund-mcp.service、fund-mcp.env.example 上传到服务器后执行：

```bash
sudo install -m 644 fund-mcp.service /etc/systemd/system/fund-mcp.service
sudo install -m 600 fund-mcp.env.example /etc/fund-mcp.env
sudo editor /etc/fund-mcp.env
sudo systemctl daemon-reload
sudo systemctl enable fund-mcp
```

确认 DATA_DIR 与网站数据目录一致；MCP_ALLOWED_HOSTS 包含实际访问域名。需要令牌时在环境文件设置 MCP_TOKEN。服务以 www-data 运行，需具备数据目录的读取及父目录的进入权限。ExecStart 使用 /opt/fund-mcp/node/bin/node；部署时也会安装 systemd runtime.conf 覆盖旧服务的运行路径，确保 npm 安装与服务使用同一 Node。

在本地仓库运行（Git Bash）：

```bash
bash deploy.sh vps   # 上传完整网页和数据，切换发布目录
bash deploy.sh mcp   # 构建并上传 MCP，服务器安装生产依赖并重启服务
```

远程账户需对 /var/www/funds 有写权限，且能执行脚本中的 sudo 安装与服务管理命令。VPS_HOST 默认 racknerd-65201，可用环境变量覆盖。MCP 代码默认安装于 /opt/fund-mcp；代码更新和环境文件安装均需要管理员权限。mcp 部署目标不会推送 GitHub Pages。

将 funds.imak.top.conf 中新增的 location = /mcp 块合入服务器实际启用的 nginx server 配置（保留现有证书配置）。然后执行：

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -fsS http://127.0.0.1:3100/healthz
sudo systemctl status fund-mcp
```

Cloudflare 对 /mcp 应绕过缓存，并允许 MCP 客户端 POST，避免交互式浏览器挑战。公开地址为 https://funds.imak.top/mcp，正式对外公布前用客户端验证工具发现及查询；healthz 仅验证进程存活。普通浏览器 GET /mcp 返回 405 是预期行为，不代表服务不可用。

## 客户端

在支持 Streamable HTTP 的客户端添加上述 URL。若启用令牌，配置 Authorization: Bearer <令牌> 请求头；令牌不应写进网页、仓库或 URL。未提供 OAuth 登录流程。

工具示例：get_latest_limits({"index":"nasdq100","buyable":true,"limit":20})。返回 nextOffset 非空时继续翻页；各指数的 checkedAt、lastChangedDate、stale 独立返回。unknown 指数及数据读取失败返回工具错误，参数超出范围由 SDK 校验。分页期间可能有新发布，应核对核查时间。

## 数据发布与维护

VPS 网页改为 releases/<发布号>/web，上传成功后通过 web 符号链接切换。查询开始时解析真实路径，同次查询固定使用同一发布，避免混读。首次从真实 web 目录迁移到符号链接会有短暂切换窗口；以后切换为原子操作。旧发布保留，可将 web 链接切回旧目录回滚；应定期清理不再需要的历史发布，避免磁盘增长。

本机 gen_web.js 写入期间不保证整批原子性，本地查询失败应待生成完成后重试。MCP 代码部署会重启服务，有短暂停机；本方案未实现零停机代码发布。

修改环境文件后执行 sudo systemctl restart fund-mcp。诊断日志：sudo journalctl -u fund-mcp -n 100。仅更新数据用 bash deploy.sh vps，无须重启 MCP；修改服务代码才用 bash deploy.sh mcp。
