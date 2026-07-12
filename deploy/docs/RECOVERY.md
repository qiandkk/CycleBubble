# 应急恢复指南

> 服务器到期、硬盘损坏、误操作时，按本指南从 GitHub 仓库一键恢复。

## 🆘 5 分钟重新部署

### 场景 1：完全换了一台新服务器

```bash
# 1. SSH 进新服务器（任意 Linux，建议 Alibaba Cloud Linux 3 / Ubuntu 22+）
ssh root@NEW_SERVER_IP

# 2. 安装 git
dnf install -y git  # 或 apt install -y git

# 3. clone 仓库
git clone https://github.com/qiandkk/CycleBubble.git
cd CycleBubble

# 4. 创建 .env（从你之前的备份恢复，或重新生成）
cp deploy/env.example .env
vim .env  # 填入 CB_JWT_SECRET、CB_ADMIN_PASSWORD、CB_GITHUB_WEBHOOK_SECRET

# 5. 一键安装
bash deploy/setup-new-server.sh

# 6. 阿里云控制台放行端口 22/80/443/9000
# 7. GitHub 仓库更新 webhook URL 为新服务器 IP
```

### 场景 2：只重启服务（代码和数据都没问题）

```bash
ssh root@8.160.187.143
systemctl restart cyclebubble-api cyclebubble-webhook nginx
```

### 场景 3：webhook 僵死了

watchdog 会自动救活（每分钟检查）。手动救：
```bash
systemctl restart cyclebubble-webhook
```

### 场景 4：手动拉最新代码（不用 webhook）

```bash
ssh root@8.160.187.143
cd /var/www/app
bash /usr/local/bin/cyclebubble-update.sh master
```

## 🔑 密钥备份

**强烈建议**：把服务器的密钥备份到一个安全的地方（比如密码管理器）：

```bash
# 在服务器上导出所有密钥
ssh root@8.160.187.143 <<'EOF'
echo "CB_JWT_SECRET=$(grep CB_JWT_SECRET /etc/systemd/system/cyclebubble-api.service | cut -d= -f2 | tr -d '\"')"
echo "CB_ADMIN_PASSWORD=$(grep CB_ADMIN_PASSWORD /etc/systemd/system/cyclebubble-api.service | cut -d= -f2 | tr -d '\"')"
echo "CB_GITHUB_WEBHOOK_SECRET=$(cat /etc/cyclebubble-webhook-secret)"
EOF
```

把这些密钥存进 1Password / Bitwarden / 加密备忘录。

⚠️ **如果密钥泄露**：
1. `CB_JWT_SECRET` 泄露 → 所有用户 token 可被伪造，**必须改**
2. `CB_ADMIN_PASSWORD` 泄露 → admin 后台可被登入，**必须改**
3. `CB_GITHUB_WEBHOOK_SECRET` 泄露 → 别人能伪造 GitHub 推送，**必须改**

修改密钥：
```bash
# 1. 生成新密钥
NEW_JWT=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")
NEW_ADMIN=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")
NEW_HOOK=$(openssl rand -hex 32)

# 2. 更新 systemd
sed -i "s|^Environment=\"CB_JWT_SECRET=.*|Environment=\"CB_JWT_SECRET=$NEW_JWT\"|" /etc/systemd/system/cyclebubble-api.service
sed -i "s|^Environment=\"CB_ADMIN_PASSWORD=.*|Environment=\"CB_ADMIN_PASSWORD=$NEW_ADMIN\"|" /etc/systemd/system/cyclebubble-api.service
echo -n "$NEW_HOOK" > /etc/cyclebubble-webhook-secret

# 3. 重启
systemctl daemon-reload
systemctl restart cyclebubble-api

# 4. GitHub webhook 设置里同步更新 Secret
```

## 💾 数据备份

```bash
# 备份真实数据库
scp root@8.160.187.143:/var/www/app/cyclebubble.db ./backup-$(date +%Y%m%d).db

# 备份演示数据库
scp root@8.160.187.143:/var/www/app/cyclebubble_demo.db ./demo-backup-$(date +%Y%m%d).db

# 定期备份（建议加 crontab，每天凌晨）
# 0 3 * * * cp /var/www/app/cyclebubble.db /var/backups/cb-$(date +\%Y\%m\%d).db
```

## 📊 服务管理速查

| 操作 | 命令 |
|------|------|
| 查看后端状态 | `systemctl status cyclebubble-api` |
| 重启后端 | `systemctl restart cyclebubble-api` |
| 查看后端日志 | `tail -f /var/log/app/cyclebubble-api.log` |
| 查看错误日志 | `tail -f /var/log/app/cyclebubble-api.err.log` |
| 查看自动更新日志 | `tail -f /var/log/app/auto-update.log` |
| 查看 webhook 日志 | `tail -f /var/log/app/webhook.log` |
| 查看 watchdog 日志 | `tail -f /var/log/app/webhook-watchdog.log` |
| 查看 nginx 访问日志 | `tail -f /www/wwwlogs/mysite.access.log` |
| 手动触发更新 | `bash /usr/local/bin/cyclebubble-update.sh master` |
| 填充演示数据 | 见 deploy/README.md |

## 🩺 故障排查

| 症状 | 排查命令 |
|------|----------|
| 主页 502 | `systemctl status cyclebubble-api` + `tail -50 /var/log/app/cyclebubble-api.err.log` |
| 主页 403 | `ls -ld /var/www/frontend` + `namei -om /var/www/frontend/index.html` |
| API CORS 错误 | `grep -A 3 "cors_origins" /var/www/app/backend/config.py` |
| Webhook failed to connect | 阿里云安全组放行 9000 + 服务器 firewalld 放行 9000 |
| 更新没生效 | `tail -50 /var/log/app/auto-update.log` |
| admin_setting UNIQUE 错误 | 已修复：见 PR `fix(backend): admin_setting seed 原子 upsert` |