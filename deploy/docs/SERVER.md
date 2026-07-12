# 服务器控制手册 (CycleBubble 部署)

> **本文件用途**：让任何 Claude 会话都能立即识别、连接、操作阿里云服务器。
> 每次会话开始时，Claude 会读这份文件 → 自动掌握全部上下文。

---

## 🖥️ 服务器基础信息

| 项目 | 值 |
|------|-----|
| **服务商** | 阿里云 ECS |
| **公网 IP** | `8.160.187.143` |
| **SSH 端口** | `22` |
| **用户名** | `root` |
| **认证方式** | SSH 密钥对（推荐） |
| **系统** | Alibaba Cloud Linux 3（RHEL/CentOS 兼容） |
| **宝塔面板** | 已装（nginx 路径：`/www/server/panel/vhost/nginx/`） |
| **服务器到期** | 用户表示即将到期，可能需要迁移 |

---

## 🔑 SSH 连接（已配置密钥认证）

**本地私钥**：`D:/AI/Claude code workspace/aliyunwebsite/deploy_key`
**公钥**：`D:/AI/Claude code workspace/aliyunwebsite/deploy_key.pub`

> **不要再用密码登录**（用户曾在对话里发过密码 `qgh021229.` 已弃用，已绑定密钥）。

### Windows 下用 Git Bash / Python 连接

```bash
# Git Bash 直接连（最简单）
ssh -i "D:/AI/Claude code workspace/aliyunwebsite/deploy_key" root@8.160.187.143

# Python paramiko 方式（Claude 用）
import paramiko
KEY = r'D:/AI/Claude code workspace/aliyunwebsite/deploy_key'
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('8.160.187.143', 22, 'root', pkey=paramiko.Ed25519Key.from_private_key_file(KEY), timeout=15)
```

### Claude 常用 SSH 助手脚本

`D:/AI/Claude code workspace/aliyunwebsite/ssh_helper.py`

```python
import paramiko, sys, os

HOST = "8.160.187.143"
PORT = 22
USER = "root"
KEY_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "deploy_key")

def run(cmd, timeout=120):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        key = paramiko.Ed25519Key.from_private_key_file(KEY_FILE)
        client.connect(HOST, PORT, USER, pkey=key, timeout=15)
    except Exception as e:
        print(f"[FAIL] {type(e).__name__}: {e}", file=sys.stderr)
        return None, str(e), -1
    try:
        stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout, get_pty=True)
        out = stdout.read().decode(errors='replace')
        err = stderr.read().decode(errors='replace')
        return out, err, stdout.channel.recv_exit_status()
    finally:
        client.close()
```

---

## 🏗️ 部署架构

```
用户浏览器
  ↓ HTTP (80)
Nginx (宝塔) 反代
  ├─ /            → /var/www/frontend/   静态文件（index.html / styles.css / script.js / api.js / admin.html / admin.js）
  ├─ /api/*       → 反代 → 127.0.0.1:8000
  ├─ /docs        → 反代 → 127.0.0.1:8000
  └─ /admin/*     → 反代 → 127.0.0.1:8000
                    ↓
                  uvicorn (systemd: cyclebubble-api)
                    ├─ FastAPI app: backend.main:app
                    ├─ 真实库: /var/www/app/cyclebubble.db (SQLite)
                    └─ 演示库: /var/www/app/cyclebubble_demo.db (SQLite, 已 seed)

GitHub webhook → :9000/webhook → cyclebubble-webhook.py → cyclebubble-update.sh
                                                                            ↓ (自动 git pull + 重启)
watchdog (cron 1分钟) → 检测 cyclebubble-webhook 存活 → 死了自动 systemctl restart
```

---

## 📂 关键文件位置

### 服务器

| 路径 | 说明 |
|------|------|
| `/var/www/app/` | 后端代码（git 仓库，含 `.git/`） |
| `/var/www/frontend/` | 前端静态文件（Nginx 站点根目录） |
| `/var/www/app/cyclebubble.db` | 真实用户数据库（敏感！） |
| `/var/www/app/cyclebubble_demo.db` | 演示数据库（可随时 reset） |
| `/var/www/app/venv/` | Python 虚拟环境 |
| `/var/www/app/backend/` | FastAPI 后端代码 |
| `/www/server/panel/vhost/nginx/mysite.conf` | Nginx 站点配置 |
| `/etc/systemd/system/cyclebubble-api.service` | 后端服务定义 |
| `/etc/systemd/system/cyclebubble-webhook.service` | webhook 服务定义 |
| `/usr/local/bin/cyclebubble-webhook.py` | webhook 接收端源码 |
| `/usr/local/bin/cyclebubble-update.sh` | git pull + 重启脚本 |
| `/usr/local/bin/webhook-watchdog.sh` | watchdog 守护脚本 |
| `/etc/cyclebubble-webhook-secret` | GitHub webhook 签名密钥（敏感！） |
| `/etc/systemd/system/cyclebubble-api.service` 里的 `Environment=` | **JWT_SECRET、ADMIN_PASSWORD、数据库 URL**（敏感！） |

### 日志

| 路径 | 说明 |
|------|------|
| `/var/log/app/cyclebubble-api.log` | 后端访问日志 |
| `/var/log/app/cyclebubble-api.err.log` | 后端错误日志（启动失败看这里）|
| `/var/log/app/auto-update.log` | webhook 自动更新日志 |
| `/var/log/app/webhook.log` | webhook 调用日志 |
| `/var/log/app/webhook-watchdog.log` | watchdog 守护日志 |
| `/www/wwwlogs/mysite.access.log` | Nginx 访问日志 |
| `/www/wwwlogs/mysite.error.log` | Nginx 错误日志 |

### 本地项目

| 路径 | 说明 |
|------|------|
| `D:/AI/Claude code workspace/aliyunwebsite/` | 项目根目录 |
| `CycleBubble/` | GitHub 仓库本地副本（用户主仓，非 fork） |
| `deploy_key` / `deploy_key.pub` | SSH 密钥对（公钥已放服务器） |
| `ssh_helper.py` | Claude SSH 助手 |
| `*.sh` | 各种一次性部署/修复脚本（运维历史） |
| `DEPLOYMENT.md` | 部署文档（v1，已被 PR #17 deploy/ 取代） |
| `SERVER.md` | 本文件 |

---

## 🔐 敏感信息（**绝对不能 push 到 GitHub**）

| 项 | 位置 |
|----|------|
| Admin 登录密码 | 当前 `noanO_dDcSvNEOh7g5q9DfwchgiSwi8YgCojHSiI1yc`（在 systemd Environment） |
| JWT 签名密钥 | systemd Environment `CB_JWT_SECRET` |
| GitHub Webhook 密钥 | `/etc/cyclebubble-webhook-secret` |
| MiniMax API Key | 数据库 `admin_setting.minimax_api_key` |
| DeepSeek API Key | 数据库 `admin_setting.deepseek_api_key` |
| 数据库内容（用户隐私） | `/var/www/app/cyclebubble*.db` |

**导出命令**（需要时给 Claude 看，**不要写进任何文件**）：

```bash
# Admin 密码
grep "CB_ADMIN_PASSWORD" /etc/systemd/system/cyclebubble-api.service | cut -d= -f2 | tr -d '"'

# JWT 密钥
grep "CB_JWT_SECRET" /etc/systemd/system/cyclebubble-api.service | cut -d= -f2 | tr -d '"'

# Webhook 密钥
cat /etc/cyclebubble-webhook-secret

# AI Key（脱敏显示前 6 + 后 4 位）
sqlite3 /var/www/app/cyclebubble.db \
  "SELECT key, substr(value,1,6) || '...' || substr(value,-4) FROM admin_setting WHERE key LIKE '%key%';"
```

---

## 🌐 GitHub 项目

| 项 | 值 |
|----|-----|
| **仓库地址** | https://github.com/qiandkk/CycleBubble |
| **Owner** | qiandkk |
| **协作 fork** | qianbkk/CycleBubble（Claude 用这个提 PR） |
| **分支策略** | master 主分支，PR 通过 merge |
| **PR 列表** | #1~#17（#12 已合并、#17 待 review） |
| **Webhook URL** | http://8.160.187.143:9000/webhook |
| **Webhook Secret** | 在 `/etc/cyclebubble-webhook-secret` |

---

## 🚀 服务管理命令速查

```bash
# 服务状态
systemctl status cyclebubble-api
systemctl status cyclebubble-webhook
systemctl status nginx

# 重启服务
systemctl restart cyclebubble-api        # 后端
systemctl restart cyclebubble-webhook    # webhook
nginx -s reload                          # nginx

# 拉最新代码 + 重启
cd /var/www/app && bash /usr/local/bin/cyclebubble-update.sh master

# 手动触发 webhook 测试（验证签名链路）
curl -X POST http://8.160.187.143:9000/webhook \
  -H "X-GitHub-Event: push" \
  -H "X-Hub-Signature-256: sha256=..." \
  -d '{"ref":"refs/heads/master"}'

# 填充演示数据库
cd /var/www/app && source venv/bin/activate && \
  CB_JWT_SECRET=$(grep "CB_JWT_SECRET" /etc/systemd/system/cyclebubble-api.service | cut -d= -f2 | tr -d '"') \
  python -m backend.seed_demo --reset

# 看数据库
sqlite3 /var/www/app/cyclebubble.db       # 真实库
sqlite3 /var/www/app/cyclebubble_demo.db  # 演示库
```

---

## 📋 已知问题 / 待办

1. **PR #17 待 review & merge**：deploy/ 目录 + admin_setting 并发修复 + AI 双 provider
2. **服务器即将到期**：用户提示过，可能需要迁移到新服务器，用 `bash deploy/setup-new-server.sh` 一键恢复
3. **阿里云 ECS 安全组 9000 端口**：必须保留放行（之前被关过一次，用户重新开放过）
4. **`api.js.orig` 残留文件**：在 `/var/www/app/` 根目录（早期手动 patch 时的备份，未跟踪）

---

## 🔄 标准工作流

```
用户说"我更新了代码" / "网站没更新" / "webhook 失败了"
   ↓
Claude 读本文件 → ssh_helper.py → 排查
   ↓
1. git status / git log  → 确认代码状态
2. systemctl status → 服务状态
3. tail 日志 → 找错误
4. 修复 → 重启 → 验证
```

---

## 💬 会话接手流程

任何 Claude 会话开始时，只需说一句：

> "接手 D:/AI/Claude code workspace/aliyunwebsite 这个项目，服务器信息看 SERVER.md"

Claude 就会自动读本文件，无缝接管所有工作。