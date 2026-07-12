#!/bin/bash
# Cron 每分钟检查 webhook 是否真的活着
# 如果死了/僵了，自动重启并记录日志
# 安装方法：
#   sudo cp webhook-watchdog.sh /usr/local/bin/webhook-watchdog.sh
#   sudo chmod 755 /usr/local/bin/webhook-watchdog.sh
#   (crontab -l 2>/dev/null; echo "* * * * * /usr/local/bin/webhook-watchdog.sh") | crontab -

LOG="/var/log/app/webhook-watchdog.log"
HEALTH=$(curl -s -m 5 http://127.0.0.1:9000/health 2>/dev/null)

if [ "$HEALTH" = '{"status": "ok"}' ]; then
    exit 0
fi

# 不健康，记录 + 重启
echo "[$(date -Iseconds)] webhook 不健康: $HEALTH - 准备重启" >> "$LOG"
systemctl restart cyclebubble-webhook
sleep 3

# 验证重启成功
NEW_HEALTH=$(curl -s -m 5 http://127.0.0.1:9000/health 2>/dev/null)
if [ "$NEW_HEALTH" = '{"status": "ok"}' ]; then
    echo "[$(date -Iseconds)] webhook 已恢复 ✓" >> "$LOG"
else
    echo "[$(date -Iseconds)] webhook 重启后仍异常: $NEW_HEALTH" >> "$LOG"
fi