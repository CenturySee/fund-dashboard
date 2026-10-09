#!/usr/bin/env bash

cd "$(dirname "$0")" || exit 1

LOG_FILE="./scheduled_update.log"

{
  echo "===== 开始执行 $(date '+%Y-%m-%d %H:%M:%S') ====="

  bash update_all.sh
  UPDATE_RESULT=$?

  bash deploy.sh vps
  DEPLOY_RESULT=$?

  echo "update_all.sh 返回码: $UPDATE_RESULT"
  echo "deploy.sh vps 返回码: $DEPLOY_RESULT"
  echo "===== 执行结束 $(date '+%Y-%m-%d %H:%M:%S') ====="

  if [ "$UPDATE_RESULT" -ne 0 ] || [ "$DEPLOY_RESULT" -ne 0 ]; then
    exit 1
  fi
} >> "$LOG_FILE" 2>&1
