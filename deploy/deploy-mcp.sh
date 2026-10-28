#!/usr/bin/env bash
# Deploy application code; install the service/env/nginx config once using MCP.md.
set -euo pipefail
cd "$(dirname "$0")/../mcp"
VPS_HOST="${VPS_HOST:-racknerd-65201}"
npm ci
npm run build
stage=$(ssh "$VPS_HOST" 'mktemp -d /tmp/fund-mcp.XXXXXXXX')
[[ "$stage" =~ ^/tmp/fund-mcp\.[a-zA-Z0-9]+$ ]] || exit 1
scp -r dist package.json package-lock.json "$VPS_HOST:$stage/"
ssh "$VPS_HOST" bash -s -- "$stage" <<'REMOTE'
set -euo pipefail
stage=$1
[[ "$stage" =~ ^/tmp/fund-mcp\.[a-zA-Z0-9]+$ ]] || exit 1
sudo install -d /opt/fund-mcp
sudo cp -r "$stage/dist" "$stage/package.json" "$stage/package-lock.json" /opt/fund-mcp/
cd /opt/fund-mcp
sudo npm ci --omit=dev
sudo systemctl restart fund-mcp
sudo systemctl is-active --quiet fund-mcp
rm -rf -- "$stage"
REMOTE
echo "MCP code deployed. Verify /mcp with an MCP client."
