#!/usr/bin/env bash
# Complete release first, then switch the data and page together.
set -euo pipefail
cd "$(dirname "$0")/.."
VPS_HOST="${VPS_HOST:-racknerd-65201}"
VPS_DEST="${VPS_DEST:-/var/www/funds}"
[[ "$VPS_DEST" =~ ^/[a-zA-Z0-9_/-]+$ && "$VPS_DEST" != / ]] || { echo 'Invalid VPS_DEST'; exit 1; }
release="$(date -u +%Y%m%dT%H%M%SZ)-$$"
ssh "$VPS_HOST" "mkdir -p '$VPS_DEST/releases/$release'"
scp -r web "$VPS_HOST:$VPS_DEST/releases/$release/"
ssh "$VPS_HOST" bash -s -- "$VPS_DEST" "$release" <<'REMOTE'
set -euo pipefail
dest=$1
release=$2
# Existing installs may have a real web directory: migrate it once.
if [ -d "$dest/web" ] && [ ! -L "$dest/web" ]; then
  mv "$dest/web" "$dest/releases/legacy-$release"
fi
ln -s "releases/$release/web" "$dest/.web-$release"
mv -Tf "$dest/.web-$release" "$dest/web"
REMOTE
echo "VPS web release activated: $release (old releases retained)"
