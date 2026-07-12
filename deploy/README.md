# CycleBubble 一键部署

> 把整个 CycleBubble 后端、前端、webhook 自动部署、watchdog 守护 全部打包成 `deploy/` 目录。
> 任何 Linux 服务器（Alibaba Cloud Linux 3 / CentOS / Ubuntu / Debian）clone 仓库后跑一行命令即可部署。

## 📂 目录结构

```
deploy/
├── README.md                       ← 本文件
├── SERVER.md                       ← 服务器信息手册（Claude 会话接手用）
├── env.example                     ← 环境变量模板（填真实值后改名 .env）
├── setup-new-server.sh             ← 一键初始化新服务器
├── nginx-mysite.conf               ← Nginx 站点配置
├── systemd/
│   ├── cyclebubble-api.service     ← 后端 systemd 定义
│   └── cyclebubble-webhook.service ← webhook systemd 定义
├── scripts/
│   ├── cyclebubble-webhook.py      ← webhook 接收端
│   ├── cyclebubble-update.sh       ← git pull + 重启脚本（webhook 触发）
│   └── webhook-watchdog.sh         ← 每分钟检查 webhook 是否还活着
└── docs/
    └── RECOVERY.md                 ← 应急恢复指南
```

## 🚀 快速开始（新服务器）

### 1. 在服务器上 clone 仓库

```bash
ssh root@YOUR_NEW_SERVER
dnf install -y git     # 或 apt install -y git
git clone https://github.com/qiandkk/CycleBubble.git
cd CycleBubble
```

### 2. 创建 .env（从模板复制，填入密钥）

```bash
cp deploy/env.example .env
vim .env
```

`.env` 里需要填三项（生成方法都在模板里）：
- `CB_JWT_SECRET` — JWT 签名密钥
- `CB_ADMIN_PASSWORD` — admin 后台密码
- `CB_GITHUB_WEBHOOK_SECRET` — GitHub webhook 签名密钥

### 3. 一键安装

```bash
bash deploy/setup-new-server.sh
```

### 4. 配置阿里云安全组

ECS 控制台 → 安全组 → 入方向放行：
- 22/SSH, 80/HTTP, 443/HTTPS, 9000/webhook

### 5. 配置 GitHub Webhook

仓库 → Settings → Webhooks → Add webhook：
- Payload URL: `http://YOUR_SERVER_IP:9000/webhook`
- Content type: `application/json`
- Secret: 必须和 .env 里的 `CB_GITHUB_WEBHOOK_SECRET` 完全一致
- Events: Just the push event

### 6.（可选）填充演示数据

```bash
cd /var/www/app
source venv/bin/activate
CB_JWT_SECRET='你的JWT密钥' python -m backend.seed_demo --reset
```

## 🛠 维护命令速查

```bash
# 服务状态
systemctl status cyclebubble-api
systemctl status cyclebubble-webhook
systemctl status nginx

# 重启服务
systemctl restart cyclebubble-api
systemctl restart cyclebubble-webhook
nginx -s reload

# 日志
tail -f /var/log/app/cyclebubble-api.log        # 后端访问日志
tail -f /var/log/app/cyclebubble-api.err.log    # 后端错误日志
tail -f /var/log/app/auto-update.log            # 自动更新日志
tail -f /var/log/app/webhook.log                # webhook 调用日志
tail -f /var/log/app/webhook-watchdog.log       # watchdog 守护日志
tail -f /www/wwwlogs/mysite.access.log          # nginx 访问日志

# 手动触发更新（不依赖 webhook）
bash /usr/local/bin/cyclebubble-update.sh master

# 数据库
sqlite3 /var/www/app/cyclebubble.db             # 真实库
sqlite3 /var/www/app/cyclebubble_demo.db        # 演示库
```

## 🆘 应急恢复

服务器宕机 / 硬盘损坏 / 误操作？看 [`docs/RECOVERY.md`](docs/RECOVERY.md)。

## 🔐 安全清单

- ✅ 密码 / 密钥从 .env 读取，**不提交到 git**
- ✅ systemd service 里的密钥通过 setup 脚本注入，模板文件用占位符
- ✅ webhook 接收端只监听 `0.0.0.0:9000`，签名校验失败返回 401
- ✅ watchdog 每分钟检查 webhook，死了自动重启
- ✅ Nginx 给静态资源加安全头，API 不缓存 HTML

## 🆚 适配多种 Nginx 安装方式

| 检测到 | 行为 |
|--------|------|
| `/www/server/panel/vhost/nginx/` 存在 | 写入宝塔路径 |
| 其他情况 | 写入标准 `/etc/nginx/conf.d/` |

| 包管理器 | 行为 |
|----------|------|
| `dnf` (Alibaba Cloud Linux / RHEL / CentOS 8+) | 优先用 dnf |
| `yum` (CentOS 7) | 用 yum |
| `apt` (Ubuntu / Debian) | 用 apt |

| 防火墙 | 行为 |
|--------|------|
| `firewalld` | 启用并开放 22/80/443 |
| `ufw` | 启用并开放 22/80/443 |

## 📋 关于 webhook 端口 9000

阿里云 ECS 控制台的安全组是**独立于服务器内部 firewalld 的第二道防火墙**。
setup 脚本会**只配置服务器内层 firewalld**（端口 9000），
**外层安全组需要在阿里云控制台手动放行**（setup 脚本无法访问阿里云 API）。