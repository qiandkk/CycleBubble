# CycleBubble 项目文件索引

> **入口原则**：
> - 新人先看 [`../README.md`](../README.md)（项目入口 + 本地开发 + PR 路线图）
> - 设计原则最高权威：[`CONSTITUTION.md`](CONSTITUTION.md)
> - 演变历史：[`PROJECT_SUMMARY.md`](PROJECT_SUMMARY.md)
> - 视觉备忘早期：[`DESIGN_NOTES.md`](DESIGN_NOTES.md)（英文）
> - 单页详细规范：[`page_manual.html`](page_manual.html)
> - 文件索引（本文件）

---

## 按任务找

| 我想…… | 看哪里 |
|---|---|
| 跑起来 + demo 体验 | [README 快速开始](../README.md#快速开始) |
| 改前端 | `frontend/` |
| 改后端 API | `backend/routers/` |
| 改后端业务（情绪 / 周期 / Pattern） | `backend/cycle_engine.py` / `patterns.py` / `ai_agent.py` |
| 改数据库 schema | `backend/models.py` + `backend/alembic/versions/` |
| 改环境变量 | `.env.example`（复制为 `backend/.env`）+ `backend/config.py` |
| 改 CI 行为 | `.github/workflows/ci.yml` |
| 改部署（Render） | `render.yaml` + `backend/main.py` CORS |
| 改 GH Pages 源 | `frontend/` 目录（必须）+ Settings → Pages → Folder=`/frontend` |
| 写产品文档 | `docs/`（根目录不接新 markdown） |
| 看产品宪法 / 历史 | `docs/CONSTITUTION.md` / `docs/PROJECT_SUMMARY.md` |
| 找某个文件干啥 | 本文件 |

---

## 根目录

| 文件 | 角色 |
|---|---|
| `README.md` | 项目入口（唯一的根 markdown） |
| `dev.bat` / `dev.ps1` | 本地一键启停（start / stop / restart / status） |
| `render.yaml` | Render 服务定义 |
| `.env.example` | 后端环境变量模板 |
| `.gitignore` | git 忽略规则 |
| `frontend/` | 前端入口子目录（GH Pages 发布源） |
| `backend/` | FastAPI 后端 |
| `docs/` | 全部产品文档集中地 |
| `design/` | 设计资产 |
| `evidence/` | 文献证据 |
| `.github/workflows/ci.yml` | CI 配置 |

## 前端 — `frontend/`（GH Pages 发布源 + 本地 dev 根）

> 本地 `dev.bat start` 启的 `http.server` 工作目录就是这个 `frontend/`，
> 所以 `http://127.0.0.1:8766/` 直接进前端，不需要 `/frontend/` 前缀。

| 文件 | 角色 |
|---|---|
| `frontend/index.html` | 5 屏 SPA 渲染入口（auth / onboard / home / record / growth / resonance）+ About modal |
| `frontend/styles.css` | Token 系统 + 5 屏样式 + iOS 安全区 + skeleton + modal |
| `frontend/script.js` | 状态机 + Bubble 实时染色 signature + 全屏编排 + About + 登出 |
| `frontend/api.js` | 后端 HTTP 客户端（`/api/auth/*` `/api/memories` `/api/patterns` `/api/bubble-state` `/api/growth` `/api/resonance/*` `/api/cycle/*`） |

> GH Pages 配置：Settings → Pages → Branch `master` · Folder `/frontend`。
> 后续前端改动只改 `frontend/`，根目录不再有副本，CI 会自动校验这个不变量。

## 后端 — `backend/`

| 文件 | 角色 |
|---|---|
| `main.py` | FastAPI 入口 + CORS 白名单 + 启动时 init_db + 自动注入 demo 账号 |
| `config.py` | `Settings`（pydantic-settings）：CB_JWT_SECRET / CORS / DATABASE_URL / DEEPSEEK_* |
| `auth.py` | `pbkdf2_sha256` 哈希 + JWT 签发 + `get_current_user` 依赖 |
| `database.py` | SQLModel engine + SQLite PRAGMA `foreign_keys=ON` + `init_db` |
| `models.py` | `User` / `Memory` / `Response` / `Cycle` 四表，`Response.memory_id` FK |
| `routers/auth.py` | `/api/auth/register` `/login` `/me` |
| `routers/memories.py` | CRUD + AI 抽取 + Pattern + Bubble 状态 + 成长页 + `accompanied_count` |
| `routers/resonance.py` | 共鸣 feed + 回应（含存在性 + `is_public` 校验） |
| `routers/cycle.py` | 经期开始 / 周期状态 |
| `cycle_engine.py` | 周期阶段 + 置信度计算（独立纯函数模块） |
| `patterns.py` | Pattern 聚合 + Bubble 视觉状态计算 |
| `ai_agent.py` | DeepSeek 客户端 + 回退抽取（无 key 时） |
| `alembic/` `alembic.ini` | 迁移目录与配置（CB_USE_ALEMBIC=1 时启用） |
| `requirements.txt` | Python 依赖 |
| `pytest.ini` `tests/` | pytest 配置 + 50+ 用例 |

## 设计资产 — `design/`

| 子目录 | 内容 |
|---|---|
| `pages/` | 单页高保真 PNG（匿名共鸣 / 周期泡泡 / 情绪记录） |
| `overview/` | 总览 / 板图 / 真实产品首页 375×812 |
| `v4-liquid/` | 当前主视觉（液态泡泡） |
| `preview/` | 早期预览（绿粉主题） |
| `review/` | 设计评审 HTML 材料 |
| `renders/` | Playwright 截图脚本输出（`.gitignore`） |
| `scripts/` | `render-screenshots.mjs` 截图脚本 |
| `prototype-archive/v1-html/` | V1 老版原型 + 字体图表（`.gitignore`） |

## 文献证据 — `evidence/`

| 文件 | 内容 |
|---|---|
| `literature-curated.json` | 17 篇筛选文献清单 + OA 链接 |
| `feature-evidence-map.html` | 文献 → 功能映射报告（可读版） |
| `feature-evidence-map.json` | 同样映射的结构化版本 |
| `papers/` | 已下载 PDF（`.gitignore`，不入仓） |

## 产品文档 — `docs/`

| 文件 | 内容 |
|---|---|
| `INDEX.md` | 本文件 |
| `CONSTITUTION.md` | 产品宪法 V2（最高设计原则） |
| `PROJECT_SUMMARY.md` | V1→V5 演变与修正记录 |
| `DESIGN_NOTES.md` | 视觉与产品原则备忘（英文） |
| `page_manual.html` | 4 个核心页面的目标、元素、情绪、流程与建议 |

## 本地开发

| 文件 | 角色 |
|---|---|
| `dev.bat` | UTF-8 BOM + chcp 65001 + ANSI 颜色，thin wrapper |
| `dev.ps1` | PowerShell 5.1+ 核心：start / stop / restart / status + 日志轮转 + demo 账号横幅 |

| 命令 | 行为 |
|---|---|
| `dev.bat`           | 交互菜单 |
| `dev.bat start`     | 后端（uvicorn :8765）+ 前端（`python -m http.server` :8766） |
| `dev.bat stop`      | 按端口查 PID → kill |
| `dev.bat restart`   | stop + 1.5s + start |
| `dev.bat status`    | 端口 + PID + HTTP `/health`、`/docs` 健康探测 |
| `dev.bat help`      | 帮助 |

## CI

| 文件 | 内容 |
|---|---|
| `.github/workflows/ci.yml` | 3 jobs：backend（compile + import + pytest）/ frontend（HTML + JS 语法）/ repo layout（无脏文件 + index.html 引用 resolve） |

## 历史 — 已合并 PR

| PR | 标题 | 关键改动 |
|---|---|---|
| #1 | 审计 4 Phase 重构 | JWT 强制 + CORS 白名单 + alembic + 50+ 测试 |
| #2 | iOS 适配 | `viewport-fit=cover` + safe-area + tap-highlight |
| #3 | 整合前端 + dev.bat | frontend/ 目录化 + 本地一键启停（中文化） |
| #4 | 前端重设计 + Bubble 染色 | frontend-design 流程 + 签名元素 + 健壮性打磨 |
| #5 | 前端迁 frontend/ + dev 直进 + CORS + 文档归类 | 4 文档进 docs/、`:8766/` 直进前端、CI 路径适配、cors 解析修 |