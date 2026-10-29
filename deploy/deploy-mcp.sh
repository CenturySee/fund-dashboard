#!/usr/bin/env bash
# Deploy application code; install the service/env/nginx config once using MCP.md.
set -euo pipefail
cd "$(dirname "$0")/../mcp"
VPS_HOST="${VPS_HOST:-racknerd-65201}"
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) { console.error("Local Node.js 22+ required"); process.exit(1); }'
npm ci
npm run build
stage=$(ssh "$VPS_HOST" 'mktemp -d /tmp/fund-mcp.XXXXXXXX')
[[ "$stage" =~ ^/tmp/fund-mcp\.[a-zA-Z0-9]+$ ]] || exit 1
scp -r dist package.json package-lock.json "$VPS_HOST:$stage/"
scp ../deploy/install-mcp-runtime.sh ../deploy/fund-mcp-runtime.conf "$VPS_HOST:$stage/"
ssh "$VPS_HOST" bash -s -- "$stage" <<'REMOTE'
set -euo pipefail
stage=$1
[[ "$stage" =~ ^/tmp/fund-mcp\.[a-zA-Z0-9]+$ ]] || exit 1
sudo install -d /opt/fund-mcp
sudo bash "$stage/install-mcp-runtime.sh"
sudo cp -r "$stage/dist" "$stage/package.json" "$stage/package-lock.json" /opt/fund-mcp/
cd /opt/fund-mcp
sudo env PATH="/opt/fund-mcp/node/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" /opt/fund-mcp/node/bin/npm ci --omit=dev
sudo install -d /etc/systemd/system/fund-mcp.service.d
sudo install -m 644 "$stage/fund-mcp-runtime.conf" /etc/systemd/system/fund-mcp.service.d/runtime.conf
sudo systemctl daemon-reload
sudo systemctl restart fund-mcp
sleep 2
sudo systemctl is-active --quiet fund-mcp || { sudo journalctl -u fund-mcp -n 30 --no-pager; exit 1; }
curl -fsS --max-time 10 http://127.0.0.1:3100/healthz
rm -rf -- "$stage"
REMOTE
echo "MCP code deployed. Verify /mcp with an MCP client."
