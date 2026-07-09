# CycleBubble

> 一个持续理解你的情绪空间。

CycleBubble 是一款帮助女性理解周期与情绪关系的产品。它不是经期预测工具，也不是冥想或治疗产品；核心价值是帮助用户理解情绪**可能从哪里来**。

项目主页（GH Pages）：<https://qiandkk.github.io/CycleBubble/>

---

## 这是一个原型项目

后端跑在 Render（`cyclebubble-api`），前端静态发布到 GitHub Pages。本地开发用 `dev.bat`。

当前阶段：**Frontend re-designed via `/frontend-design`**（PR #4）——5 屏 SPA + Bubble 实时染色签名元素 + 完整健壮性打磨。

---

## 产品定位

用户打开 CycleBubble 后，第一眼应看到自己的周期状态和情绪线索，而不是产品理念：

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
├── README.md                ← 本文件：项目入口
├── INDEX.md                 ← 文件索引
├── CONSTITUTION.md          ← 产品宪法（最高设计原则）
├── PROJECT_SUMMARY.md       ← V1→V5 演变与修正记录
├── DESIGN_NOTES.md          ← 视觉与产品原则备忘（英文）
│
├── index.html               ← GH Pages 入口 (5 屏 SPA)
├── styles.css               ← Token + 组件样式 (含 iOS 安全区)
├── script.js                ← 状态机 + Bubble 实时染色 + 全屏编排
├── api.js                   ← 后端 HTTP 客户端 (8765 / Render)
│
├── dev.bat  /  dev.ps1      ← 本地一键启停
│
├── backend/                 ← FastAPI (uvicorn + SQLModel + SQLite + alembic)
│   ├── main.py  config.py  database.py  models.py  auth.py
│   ├── ai_agent.py  patterns.py  cycle_engine.py
│   ├── alembic/  alembic.ini  requirements.txt  pytest.ini
│   ├── routers/  (auth / memories / resonance / cycle)
│   └── tests/   (50+ pytest 用例)
│
├── design/                  ← 设计资产
│   ├── pages/               单页高保真 PNG
│   ├── overview/            总览/板图/真实产品首页
│   ├── v4-liquid/           v4 液态泡泡视觉
│   ├── preview/             早期预览
│   ├── review/              设计评审 HTML
│   ├── renders/             Playwright 截图 (gitignored)
│   ├── scripts/             截图脚本
│   └── prototype-archive/   V1 老原型 (gitignored)
│
├── evidence/                ← 文献证据
│   ├── literature-curated.json     17 篇筛选清单 + OA 链接
│   ├── feature-evidence-map.{html,json}  文献 → 功能映射
│   └── papers/            已下载 PDF (gitignored)
│
├── docs/
│   └── page_manual.html     页面说明书
│
├── .github/workflows/ci.yml ← CI (backend / frontend / layout 3 jobs)
├── render.yaml              ← Render 服务定义
├── .env.example             ← 环境变量模板
└── .gitignore
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

前端代码里所有资源路径都是相对路径，无论仓库根目录还是 `https://<user>.github.io/<repo>/` 都能正常加载。

## 本地开发 (`dev.bat`)

仓库根目录的 `dev.bat` / `dev.ps1` 提供一键启停（参考 Novel_AI/dev.bat 与 RunKeepOnline.bat 风格）：

| 命令 | 行为 |
|---|---|
| `dev.bat`         | 交互菜单（启动 / 停止 / 重启 / 状态 / 退出） |
| `dev.bat start`   | 后端（uvicorn :8765）+ 前端（`python -m http.server` :8766） |
| `dev.bat stop`    | 按端口查 PID → kill |
| `dev.bat restart` | stop + 1.5s + start |
| `dev.bat status`  | 端口 + PID + HTTP `/health`、`/docs` 健康探测 |
| `dev.bat help`    | 帮助 |

**端口约定**：
- `http://127.0.0.1:8765` → backend (uvicorn)
- `http://127.0.0.1:8766` → frontend（`python -m http.server`，与 GH Pages 根路径一致）

**调用栈**：`dev.bat`（UTF-8 BOM + chcp 65001 + ANSI 颜色）是 thin wrapper，把重活委托给 `dev.ps1`。PowerShell 在 Windows 上对后台进程 + IO 重定向更可靠。

**环境**：硬编码 dev 默认值（`CB_JWT_SECRET`、`CB_CORS_ORIGINS`），无需复制 `.env.example`。

### 测试账号（Demo 本地开箱即用）

后端 `startup()` 会自动注入一个本地演示账号（**仅本地 SQLite**，不会出现在 Render 部署上）：

| 字段 | 值 |
|---|---|
| 账号 | `demo` |
| 密码 | `demo` |

- 想换一个？直接在前端用"注册"走正常流程，会走真实 pbkdf2_sha256 哈希。
- 想关掉自动注入？`CB_DEMO_USER=0 dev.bat start` 即可。
- **不要**把这个账号推到生产环境——它的密码是写在源码里的固定值。Render 部署用自己注册的账号。

### 已知限制
详见 `dev.ps1` 头注。简单说：`Set-Content` 在刚启动 python 重定向 IO 的目录偶尔静默失败，造成 `backend.pid` 偶尔不写。功能不受影响（`status` 偶显示 `foreign`、`stop` 按端口杀依然 OK）。

## 路线图 — 已合并的 PR

| PR | 标题 | 关键改动 |
|---|---|---|
| #1 | 审计 4 Phase 重构 | JWT 强制 + CORS 白名单 + alembic + 50+ 测试 |
| #2 | iOS 适配 | `viewport-fit=cover` + safe-area + tap-highlight |
| #3 | 整合前端 + dev.bat | frontend/ 目录化 + 本地一键启停 |
| #4 | 前端整体重设计 + Bubble 实时染色 | frontend-design 流程 + 签名元素 + 完整健壮性打磨 |
| #5 | 修 CI cache-bust 查询 | strip `?v=xxx` 后再 stat |

## CI

- `.github/workflows/ci.yml`：3 个 job
  - **backend**：Python 3.12，compile-check + import smoke + pytest
  - **frontend**：HTML 结构校验（Python stdlib parser）+ node `--check` JS 语法
  - **repo layout**：防止 temp_body.json / docs/ 旧副本回归 + index.html 引用路径存在性
- 触发：push 到 master + 任何 PR
- Concurrency：`cancel-in-progress` 自动取消同分支旧 run 节省 CI 分钟

## 数据库迁移 (alembic)

后端用 [alembic](https://alembic.sqlalchemy.org/) 做 schema 版本化管理。
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

## 测试

```bash
cd backend
CB_JWT_SECRET=test-secret pytest -q
```

测试覆盖（50+ 个用例）：
- `cycle_engine` 的周期阶段边界值与置信度分级
- `auth` 的注册/登录/token/401 路径
- `resonance` 的存在性 + `is_public` 权限校验
- `memories` 的 `accompanied_count` 方向

不依赖真实数据库，默认走临时 sqlite。