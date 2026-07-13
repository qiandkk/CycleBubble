#!/bin/bash
# CycleBubble auto-update script - called by webhook on push events
# Pulls latest code, installs deps, refreshes frontend, restarts backend.
#
# 安全增强（PR #17 改进）：
# - git pull 前先备份数据库（.db → .db.YYYYMMDD-HHMMSS.bak），出问题时可回滚
# - 健康检查 /api/healthz（真实查 DB + 列路由），不只是返回 ok
# - 任一步骤失败立即退出，并保留备份
set +e

APP_DIR="/var/www/app"
WEB_ROOT="/var/www/frontend"
SERVICE_NAME="cyclebubble-api"
BRANCH="${1:-master}"
LOG="/var/log/app/auto-update.log"
BACKUP_DIR="/var/www/app/backups"

log() {
    echo "[$(date -Iseconds)] $*" | tee -a "$LOG"
}

cd "$APP_DIR" || { log "FAIL: cd $APP_DIR"; exit 1; }

log "=========================================="
log "Auto-update triggered, branch=$BRANCH"
log "=========================================="

# 0. 数据库快照备份（在 git pull 前做，这样新代码即使有 bug 也能回滚）
log "[0/6] backup databases to $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
for db in cyclebubble.db cyclebubble_demo.db; do
    if [[ -f "$db" ]]; then
        bak="$BACKUP_DIR/${db%.db}.${STAMP}.bak"
        cp -p "$db" "$bak"
        log "  backup: $db -> $bak ($(stat -c %s "$bak" 2>/dev/null || stat -f %z "$bak") bytes)"
    fi
done
# 只保留最近 30 个备份
ls -1t "$BACKUP_DIR"/*.bak 2>/dev/null | tail -n +31 | xargs -r rm -f

# 1. Pull latest
log "[1/6] git fetch + reset to origin/$BRANCH"
git fetch origin "$BRANCH" --prune 2>&1 | tail -3 | tee -a "$LOG"
git reset --hard "origin/$BRANCH" 2>&1 | tee -a "$LOG"
NEW_COMMIT=$(git rev-parse --short HEAD)
log "now at commit: $NEW_COMMIT"

# 2. (api.js BASE 自部署同源 由 PR #12 已在代码里默认，无需 patch)

# 3. Install/update Python deps
log "[3/6] pip install -r requirements.txt"
source venv/bin/activate
pip install -r requirements.txt --quiet 2>&1 | tail -3 | tee -a "$LOG"

# 4. Refresh frontend files
# 用 cat > 强制重写 + log 错误；单文件失败仅 warn，不阻塞整个 deploy
log "[4/6] copy frontend to nginx root"
FRONTEND_FILES="index.html styles.css script.js api.js admin.html admin.js"
for f in $FRONTEND_FILES; do
    if [[ ! -f "$f" ]]; then
        log "  WARN: source not found: $f"
        continue
    fi
    if cat "$f" > "$WEB_ROOT/$f.tmp" 2>>"$LOG" && mv -f "$WEB_ROOT/$f.tmp" "$WEB_ROOT/$f" 2>>"$LOG"; then
        log "  copied: $f"
    else
        log "  WARN: cat/mv failed: $f"
        rm -f "$WEB_ROOT/$f.tmp" 2>/dev/null
    fi
done
chown -R www:www "$WEB_ROOT"
chmod 755 "$WEB_ROOT"
find "$WEB_ROOT" -type f -exec chmod 644 {} +

# 5. Restart backend
log "[5/6] restart $SERVICE_NAME"
systemctl restart "$SERVICE_NAME"
sleep 3

# 5.5 真实健康检查：等 uvicorn 起来后访问 /api/healthz（查 DB）
# 失败时回滚到上一 commit + 恢复数据库
log "[5.5/6] real health check (DB + routes)"
HEALTH_OK=0
for i in 1 2 3 4 5; do
    HEALTH_JSON=$(curl -s -m 5 http://127.0.0.1:8000/api/healthz 2>/dev/null)
    if echo "$HEALTH_JSON" | grep -q '"db":"ok"'; then
        HEALTH_OK=1
        log "  /api/healthz OK: $HEALTH_JSON"
        break
    fi
    log "  /api/healthz not ready (try $i): $HEALTH_JSON"
    sleep 2
done

if [[ $HEALTH_OK -ne 1 ]]; then
    log "✗ health check FAILED, rolling back to previous commit"
    PREV_COMMIT=$(git rev-parse HEAD@{1} 2>/dev/null)
    if [[ -n "$PREV_COMMIT" ]]; then
        git reset --hard "$PREV_COMMIT"
        # 恢复数据库到最新备份
        for db in cyclebubble.db cyclebubble_demo.db; do
            latest_bak=$(ls -1t "$BACKUP_DIR/${db%.db}."*.bak 2>/dev/null | head -1)
            if [[ -n "$latest_bak" ]]; then
                cp -p "$latest_bak" "$db"
                log "  restored $db from $latest_bak"
            fi
        done
        systemctl restart "$SERVICE_NAME"
        sleep 3
        log "  rollback complete, on commit $(git rev-parse --short HEAD)"
    fi
    log "✗ Auto-update aborted, manual inspection required"
    exit 1
fi

# 6. Reload nginx
nginx -s reload 2>&1 | tee -a "$LOG"

log "✓ Auto-update complete, on commit $NEW_COMMIT"
log "=========================================="
