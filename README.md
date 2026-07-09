# CycleBubble

CycleBubble 是一款帮助女性理解周期与情绪关系的产品。它不是经期预测工具，也不是冥想或治疗产品；核心价值是帮助用户理解情绪可能从哪里来。

> **项目状态**：原型阶段。后端跑通 `cyclebubble-api`（Render 部署），前端静态发布到 GitHub Pages。
> PR #3 含本分支最近的前端整合与本地开发脚本。

## 产品定位

用户打开 CycleBubble 后，第一眼应看到自己的周期状态和情绪线索，而不是产品理念。产品重点包括：

- 当前周期状态
- 情绪倾向解释
- 今日关注点
- 用户个人记录线索
- 匿名共鸣机制

## Demo 核心页面

| 页面 | 位置 |
|---|---|
| 首页（今日） | `index.html` → 屏幕 `screen-home` |
| 周期泡泡页 | `index.html` → 屏幕 `screen-growth` 旁的周期解释卡 |
| 情绪记录页 | `index.html` → 屏幕 `screen-record` |
| 匿名共鸣页 | `index.html` → 屏幕 `screen-resonance` |

## 目录结构

```
.
├── README.md  /  INDEX.md  /  CONSTITUTION.md  /  PROJECT_SUMMARY.md
│              DESIGN_NOTES.md  /  youhua.txt
├── .env.example  /  .gitignore  /  render.yaml
│
├── index.html             ← GH Pages 入口 (5 屏 SPA)
├── dev.bat  /  dev.ps1    ← 本地一键启停 (参见「本地开发」)
│
├── frontend/              ← 前端资源 (与 GH Pages 根路径兼容)
│   ├── styles.css
│   ├── script.js
│   └── api.js
│
├── backend/               ← FastAPI (uvicorn + SQLModel + SQLite + alembic)
│   ├── main.py  config.py  database.py  models.py  auth.py
│   ├── ai_agent.py  patterns.py  cycle_engine.py
│   ├── alembic/  alembic.ini  requirements.txt  pytest.ini
│   ├── routers/  (auth / memories / resonance / cycle)
│   └── tests/   (50+ 个 pytest 用例,在 PR #1 上)
│
├── design/                ← 设计资产
│   ├── pages/             各页面高保真 PNG (匿名共鸣/周期泡泡/情绪记录)
│   ├── overview/          总览/板图/真实产品首页
│   ├── v4-liquid/         v4 液态泡泡视觉 (当前主视觉)
│   ├── preview/           早期预览图
│   ├── review/            设计评审 HTML
│   ├── renders/           Playwright 截图脚本输出 (gitignored)
│   ├── scripts/           render-screenshots.mjs
│   └── prototype-archive/
│       └── v1-html/       V1 老版 HTML 原型 + 字体/图表 (gitignored)
│
├── evidence/              ← 文献证据
│   ├── literature-curated.json     17 篇筛选清单 + OA 链接
│   ├── feature-evidence-map.{html,json}  文献 → 功能映射
│   └── papers/            已下载 PDF (gitignored)
│
├── docs/
│   └── page_manual.html   页面说明书
│
└── tools/                 (已移入 design/scripts/)
```

## 设计原则

- 用户第一眼看到自己的数据，而不是产品理念
- 数据是解释依据，不是视觉主角
- 首页回答"我的情绪可能从哪里来"
- 避免科技感、赛博朋克、AI 概念图和玻璃拟态
- 保持温柔、克制、留白和可信赖

## 关于学术论文

`evidence/papers/` 中的学术论文 PDF 不会推送到 GitHub（`.gitignore`）。仓库只保留文献清单和证据映射文件，避免上传论文全文。

## GitHub Pages 部署

本仓库的 GitHub Pages 源是**仓库根目录**（`index.html` 必须在根目录，GH Pages 才能直接访问）。
若之前是从 `/docs` 部署，请到仓库 Settings → Pages 把 Source 改为 `(root)`。

前端代码里所有资源路径（`./frontend/styles.css` 等）都是相对路径，
无论仓库根目录还是 `https://<user>.github.io/<repo>/` 都能正常加载。

## 本地开发 (`dev.bat`)

仓库根目录的 `dev.bat`/`dev.ps1` 提供一键启停（参考 Novel_AI/dev.bat 与 RunKeepOnline.bat 风格）：

| 命令 | 行为 |
|---|---|
| `dev.bat`            | 交互菜单（start/stop/restart/status/exit） |
| `dev.bat start`      | 后端（uvicorn :8765）+ 前端（`python -m http.server` :8766） |
| `dev.bat stop`       | 按端口查 PID → kill |
| `dev.bat restart`    | stop + 1.5s + start |
| `dev.bat status`     | 端口 + PID + HTTP /health、/docs 健康探测 |
| `dev.bat help`       | 帮助 |

**端口约定**：
- `http://127.0.0.1:8765`  →  backend (uvicorn)
- `http://127.0.0.1:8766`  →  frontend (`python -m http.server`, 与 GH Pages 根路径完全一致)

**调用栈**：`dev.bat` (UTF-8 BOM + chcp 65001 + ANSI 颜色) 是 thin wrapper，把重活委托给 `dev.ps1`。PowerShell 在 Windows 上对后台进程 + IO 重定向更可靠。

**环境**：硬编码 dev 默认值（`CB_JWT_SECRET`、`CB_CORS_ORIGINS`），无需复制 `.env.example`。

**已知限制**：详见 `dev.ps1` 头注。简单说：`Set-Content` 在刚启动 python 重定向 IO 的目录偶尔静默失败，造成 `backend.pid` 偶尔不写。功能不受影响（`status` 偶显示 `foreign`、`stop` 按端口杀依然 OK）。

### 测试账号（Demo 本地开箱即用）

后端 `startup()` 会自动注入一个本地演示账号（仅本地 SQLite，**不会**出现在 Render 部署上）：

| 字段 | 值 |
|---|---|
| email    | `demo` |
| password | `demo` |
| nickname | `演示用户` |

- 想换一个账号？直接在前端用「注册」走正常流程，会走真实 pbkdf2_sha256 哈希。
- 想关掉自动注入？`CB_DEMO_USER=0 dev.bat start` 即可。
- **不要**把这个账号推到生产环境——它是写在源码里的固定账号。Render 部署用自己注册的账号。

## 数据库迁移 (PR #1+)

后端引入 [alembic](https://alembic.sqlalchemy.org/) 做 schema 版本化管理。
当前默认仍走 `backend/database.py:init_db()` 中的 `SQLModel.metadata.create_all()`，
保持开箱即用、不破坏现有 demo 部署；生产化阶段切换 `CB_USE_ALEMBIC=1` 后
schema 演进由 alembic 完全接管。

### 常用命令

```bash
cd backend
alembic revision --autogenerate -m "describe your change"
alembic upgrade head              # 升到最新
alembic downgrade -1              # 回退一个版本
alembic downgrade base            # 回退到初始（清空所有表）
alembic current                   # 查看当前版本
alembic history                   # 查看迁移历史
```

### 数据库 URL

迁移脚本统一从 `backend/config.py:settings.database_url` 读 URL，
由 `CB_DATABASE_URL` 环境变量注入。生产化时只需：

```bash
export CB_DATABASE_URL=postgresql://user:pass@host:5432/cyclebubble
alembic upgrade head
```

业务代码无需任何改动。

### 生产部署推荐

```bash
export CB_USE_ALEMBIC=1
export CB_DATABASE_URL=postgresql://...
alembic upgrade head
python -m uvicorn main:app ...
```

未设置 `CB_USE_ALEMBIC` 时，`init_db()` 仍会 `create_all`。

## 测试 (PR #1+)

```bash
cd backend
CB_JWT_SECRET=test-secret pytest -q
```

测试覆盖（50+ 个用例）：
- `cycle_engine` 的周期阶段边界值与置信度分级
- `auth` 的注册/登录/token/401 路径
- `resonance` 的存在性 + `is_public` 权限校验（Phase 1 修复）
- `memories` 的 `accompanied_count` 方向（Phase 1 修复）

不依赖真实数据库，默认走临时 sqlite。
