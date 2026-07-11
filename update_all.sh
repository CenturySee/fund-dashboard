#!/usr/bin/env bash
# update_all.sh —— 每周一键：刷新两个指数的数据 + 部署上线。
# 用法：bash update_all.sh [pages|vps|both]   （部署目标透传给 deploy.sh，默认 pages）
# 依赖同级目录的 ../nasdq100 和 ../sp500（各自的 run_weekly.sh 会自行 cd 到本项目目录）。
# 单独更新某一个指数：直接跑对应项目的 run_weekly.sh，再 bash deploy.sh [目标] 即可。
set -uo pipefail
cd "$(dirname "$0")"          # fund-dashboard/
TARGET="${1:-pages}"          # 部署目标，透传给 deploy.sh

echo "########## [1/3] 纳指100 ##########"
bash ../nasdq100/run_weekly.sh || echo "⚠ 纳指100 更新失败，继续跑标普500"

echo ""
echo "########## [2/3] 标普500 ##########"
bash ../sp500/run_weekly.sh   || echo "⚠ 标普500 更新失败，继续部署已更新的部分"

# 两个 run_weekly.sh 末尾都已调 gen_web.js 重建全部指数，这里只负责提交推送
echo ""
echo "########## [3/3] 部署上线（$TARGET） ##########"
bash ./deploy.sh "$TARGET"
