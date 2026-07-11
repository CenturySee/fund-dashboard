# 部署到 VPS（方案 C：非标端口 8443 + Cloudflare Origin Rules）

前提：域名 `imak.top` 托管在 Cloudflare，VPS 的 80/443/8000 已被别的服务占用。
本方案让 nginx 只监听 **8443**，由 Cloudflare 的 **Origin Rules** 把回源端口从 443 改写到 8443，
访客访问 `https://fund.imak.top`（**URL 不带端口**）。用子域名 `fund`，不影响现有站点。

端口可换，把下文所有 `8443` 一起改即可（原则上任意端口都行，Origin Rules 不受 CF 端口白名单限制）。

---

## 1. 上传静态文件

在 VPS 上准备目录，把仓库 `web/` 同步过去：

```bash
sudo mkdir -p /var/www/funds
# 本机（Git Bash）执行，注意 web/ 后面的斜杠
rsync -avz --delete ./web/ user@VPS_IP:/tmp/funds-web/
# VPS 上
sudo rsync -a --delete /tmp/funds-web/ /var/www/funds/web/
```

## 2. 生成并安装 Cloudflare Origin Certificate

CF 后台 → 你的域名 → **SSL/TLS → Origin Server → Create Certificate**
- Hostnames 填 `fund.imak.top`（或 `*.imak.top`）
- 生成后把两段内容存到 VPS：

```bash
sudo mkdir -p /etc/nginx/ssl/fund.imak.top
sudo tee /etc/nginx/ssl/fund.imak.top/origin.pem  # 粘贴 Origin Certificate
sudo tee /etc/nginx/ssl/fund.imak.top/origin.key  # 粘贴 Private Key
sudo chmod 600 /etc/nginx/ssl/fund.imak.top/origin.key
```

SSL/TLS 加密模式设为 **Full (strict)**（CF 会校验这张 Origin 证书）。

## 3. 装 nginx 配置

把 `funds.imak.top.conf` 拷到 VPS：

```bash
sudo cp nginx-fund.imak.top.conf /etc/nginx/conf.d/fund.imak.top.conf
sudo nginx -t && sudo systemctl reload nginx
```

## 4. 防火墙：只放行 Cloudflare 回源 IP 到 8443

不要对全网开 8443，只放 Cloudflare 的回源网段（否则有人直连你的源站绕过 CF）：

```bash
# 拉取 CF 官方 IP 段并放行到 8443（ufw 示例）
for ip in $(curl -s https://www.cloudflare.com/ips-v4) $(curl -s https://www.cloudflare.com/ips-v6); do
  sudo ufw allow proto tcp from "$ip" to any port 8443
done
sudo ufw reload
```

（用 firewalld / 云厂商安全组同理：源地址限 CF 段，目标端口 8443。）

## 5. Cloudflare DNS

DNS → 添加记录：`A  fund  ->  VPS_IP`，代理状态 **橙云（Proxied）** 打开。

## 6. Cloudflare Origin Rules（本方案的核心）

Rules → **Origin Rules** → Create rule：
- **When incoming requests match**：`Hostname` `equals` `fund.imak.top`
- **Then... Rewrite to**：**Destination Port** → `8443`
- Deploy。

这样访客走标准 443，CF 回源时自动改连你的 8443。

## 7. 验证

```bash
curl -I https://fund.imak.top                 # 期望 200，且带 cf-* 响应头
curl -I --resolve fund.imak.top:8443:VPS_IP https://fund.imak.top:8443/  # 直连源站自测
```

浏览器打开 https://fund.imak.top ，看板能切指数/切日期即成功。

---

## 更新流程（替代 GitHub Pages 或与其并存）

现有 `update_all.sh` 结尾走的是 push → GitHub Pages。自建 VPS 后，把「发布」换成 rsync 到 VPS：

```bash
node gen_web.js
rsync -avz --delete ./web/ user@VPS_IP:/tmp/fund-web/ \
  && ssh user@VPS_IP 'sudo rsync -a --delete /tmp/fund-web/ /var/www/fund-dashboard/web/'
```

静态站无需重启 nginx，rsync 完即生效（注意 CF 边缘缓存，改完可在 CF 后台 Purge，
或给 `index.html` 保持 no-cache——本仓库 nginx 配置已这么设）。

## 排错

- 访问报 **521/522**：源站没起或防火墙没放 CF IP 到 8443 → 查 `systemctl status nginx`、`ufw status`。
- 报 **526**（invalid cert）：Full(strict) 下 Origin 证书没装对，或 server_name 不匹配。
- 打开是**别的站点**：说明 Origin Rules 没生效，回源打到了默认 443 的那个服务；检查 Origin Rules 的 Hostname 匹配与部署状态。
- URL 里被迫带 `:8443` 才能打开：那是没配 Origin Rules，只靠橙云端口白名单在硬撑——回到第 6 步。
