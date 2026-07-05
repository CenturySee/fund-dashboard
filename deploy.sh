#!/usr/bin/env bash
# deploy.sh —— 把最新的 web/ 数据提交并推送，触发 GitHub Actions 自动发布到 Pages。
# 用法：bash deploy.sh   （通常由 update_all.sh 末尾调用，也可手动单独跑）
# 数据无变化时自动跳过，不产生空提交。
set -uo pipefail
cd "$(dirname "$0")"

git add -A
if git diff --cached --quiet; then
  echo "web/ 无变化，跳过部署（线上已是最新）"
  exit 0
fi

git commit -q -m "数据更新 $(date +%Y-%m-%d)"
if git push -q origin main; then
  echo "✓ 已推送，GitHub Actions 约 1 分钟内发布："
  echo "  https://centurysee.github.io/fund-dashboard/"
else
  echo "⚠ 推送失败：检查网络 / gh 登录（gh auth status）后重试 bash deploy.sh"
  exit 1
fi
