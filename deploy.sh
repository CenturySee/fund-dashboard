#!/usr/bin/env bash
# deploy.sh —— 发布最新的 web/。可选目标：pages / vps / both（默认 pages，向后兼容）。
# 用法：
#   bash deploy.sh          # 只推 GitHub Pages（默认）
#   bash deploy.sh pages    # 同上
#   bash deploy.sh vps      # 只 rsync 到 VPS
#   bash deploy.sh both     # 两者都推
# VPS 目标用环境变量配置（可写进 ~/.bashrc 或临时前置）：
#   VPS_HOST=user@1.2.3.4 VPS_DEST=/var/www/fund-dashboard/web bash deploy.sh vps
# 数据无变化时 Pages 自动跳过（不产生空提交）；VPS 走 rsync，自动只传差异。
set -uo pipefail
cd "$(dirname "$0")"

TARGET="${1:-pages}"

VPS_HOST="${VPS_HOST:-root@155.94.155.248}"           # 例：deploy@203.0.113.10
VPS_TMP="${VPS_TMP:-/tmp/funds-web}"           # 中转目录（rsync 落点，再 sudo 搬到 DEST）
VPS_DEST="${VPS_DEST:-/var/www/funds}"

deploy_pages() {
  git add -A
  if git diff --cached --quiet; then
    echo "web/ 无变化，跳过 Pages（线上已是最新）"
    return 0
  fi
  git commit -q -m "数据更新 $(date +%Y-%m-%d)"
  if git push -q origin main; then
    echo "✓ 已推送，GitHub Actions 约 1 分钟内发布："
    echo "  https://centurysee.github.io/fund-dashboard/"
  else
    echo "⚠ 推送失败：检查网络 / gh 登录（gh auth status）后重试 bash deploy.sh pages"
    return 1
  fi
}

deploy_vps() {
  if [ "$VPS_HOST" = "user@VPS_IP" ]; then
    echo "⚠ 未配置 VPS_HOST，跳过 VPS。用法：VPS_HOST=user@你的IP bash deploy.sh vps"
    return 1
  fi
  # echo "→ rsync web/ 到 $VPS_HOST:$VPS_DEST"
  # rsync -avz --delete ./web/ "$VPS_HOST:$VPS_TMP/" \
  #   && ssh "$VPS_HOST" "sudo rsync -a --delete '$VPS_TMP/' '$VPS_DEST/'" \
  #   && echo "✓ VPS 已更新（静态站 rsync 即时生效，无需 reload nginx）"
  echo "→ scp -r web/ 到 $VPS_HOST:$VPS_DEST"
  scp -r ./web/ "$VPS_HOST:$VPS_DEST/" \
    && echo "✓ VPS 已更新（静态站 scp 即时生效，无需 reload nginx）"
}

case "$TARGET" in
  pages) deploy_pages ;;
  vps)   deploy_vps ;;
  both)
    ok=0
    deploy_pages || ok=1
    deploy_vps   || ok=1
    exit $ok
    ;;
  *)
    echo "用法：bash deploy.sh [pages|vps|both]"
    exit 2
    ;;
esac
