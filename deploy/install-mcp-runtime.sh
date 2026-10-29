#!/usr/bin/env bash
# Run on VPS as root. Dedicated runtime; does not change system Node/npm.
set -euo pipefail
runtime=/opt/fund-mcp/node
version=v22.23.4
if [ -x "$runtime/bin/node" ] && [ "$("$runtime/bin/node" --version)" = "$version" ]; then
  exit 0
fi
case "$(uname -m)" in
  x86_64) arch=x64 ;;
  aarch64) arch=arm64 ;;
  *) echo 'Unsupported architecture' >&2; exit 1 ;;
esac
archive="node-$version-linux-$arch.tar.xz"
stage=$(mktemp -d /tmp/fund-node.XXXXXXXX)
trap 'rm -rf -- "$stage"' EXIT
cd "$stage"
curl -fsSLO --connect-timeout 15 --max-time 300 "https://nodejs.org/dist/$version/$archive"
curl -fsSLO --connect-timeout 15 --max-time 60 "https://nodejs.org/dist/$version/SHASUMS256.txt"
awk -v file="$archive" '$2 == file' SHASUMS256.txt > checksum.txt
test -s checksum.txt
sha256sum -c checksum.txt
tar -xJf "$archive"
"$stage/node-$version-linux-$arch/bin/node" --version
install -d /opt/fund-mcp
if [ -e "$runtime" ]; then
  mv "$runtime" "/opt/fund-mcp/node-backup-$(date +%s)"
fi
mv "node-$version-linux-$arch" "$runtime"
"$runtime/bin/node" --version
