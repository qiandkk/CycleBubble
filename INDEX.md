# CycleBubble 项目文件索引

> 仓库结构按用途分层：前端资源 / 后端 / 设计资产 / 文献证据 / 文档。
> 当前分支基于 master，PR #1（审计 + 重排）与 PR #2（iOS 适配）尚在合并队列。

---

## 根目录文档

| 文件 | 内容 |
|---|---|
| `README.md` | 项目入口 + 目录结构 + 部署 + 数据库迁移 + 测试 + 本地开发 |
| `CONSTITUTION.md` | 产品宪法（V2）：最高设计原则，所有改动以此为准 |
| `PROJECT_SUMMARY.md` | V1→V5 演变与修正记录 |
| `DESIGN_NOTES.md` | 视觉与产品原则备忘 |
| `youhua.txt` | 项目优化指南（下一步动作） |
| `INDEX.md` | 本文件 |
| `render.yaml` | Render 服务定义（Web 自动生成 CB_JWT_SECRET） |
| `.env.example` | 后端环境变量模板（CB_JWT_SECRET / DEEPSEEK_API_KEY / CB_CORS_ORIGINS / CB_DATABASE_URL） |
| `.gitignore` | git 忽略规则 |

---

## 前端 — GitHub Pages 发布源

| 文件 | 内容 |
|---|---|
| `index.html` | V5 渲染入口（5 屏 SPA：首页 / 记录 / 理解 / 成长 / 回应） |

## 前端 — `frontend/`

| 文件 | 内容 |
|---|---|
| `styles.css` | 颜色变量 + 玻璃/液体/纹理层叠样式（包含 iOS @media 安全区适配） |
| `script.js` | V5 状态机 + Bubble SVG 液体波浪 + AI 抽取编排 |
| `api.js` | 后端 HTTP 客户端，localStorage 存储 JWT，Render URL 自动适配 |

---

## 后端 — `backend/`

| 文件 | 内容 |
|---|---|
| `main.py` | FastAPI 入口，CORS 中间件，`/` 与 `/api/health` 健康检查 |
| `config.py` | `Settings`（pydantic-settings），CB_JWT_SECRET/CORS/DATABASE_URL |
| `auth.py` | `pbkdf2_sha256` 哈希 + JWT 签发 + `get_current_user` 依赖 |
| `database.py` | SQLModel engine + SQLite PRAGMA foreign_keys=ON + `init_db` |
| `models.py` | `User` `Memory` `Response` `Cycle` 四表，Response.memory_id FK |
| `routers/auth.py` | `/api/auth/register` `/login` `/me` |
| `routers/memories.py` | CRUD + AI 抽取 + Pattern + Bubble 状态 + 成长页 + `accompanied_count` |
| `routers/resonance.py` | 共鸣 feed + 回应（含存在性 + `is_public` 校验） |
| `routers/cycle.py` | 经期开始 / 周期状态 |
| `cycle_engine.py` | 周期阶段 + 置信度计算（独立纯函数模块） |
| `patterns.py` | Pattern 聚合 + Bubble 视觉状态计算 |
| `ai_agent.py` | DeepSeek 客户端 + 回退抽取（无 key 时） |
| `alembic/` | 迁移目录（PR #1 起） |
| `alembic.ini` | alembic 配置（PR #1 起） |
| `requirements.txt` | 依赖清单 |
| `tests/` | 50+ 个 pytest 用例（PR #1 起） |
| `pytest.ini` | pytest 配置（PR #1 起） |

---

## 设计资产 — `design/`

### `design/pages/` — 单页高保真
- `cyclebubble_page_cycle_bubble_hifi.png` — 周期泡泡页
- `cyclebubble_page_emotion_record_hifi.png` — 情绪记录页
- `cyclebubble_page_anonymous_resonance_hifi.png` — 匿名共鸣页

### `design/overview/` — 总览 / 板图 / 真实产品首页
- `cyclebubble_three_core_pages_hifi.png` — 三核心页总览
- `cyclebubble_home_real_product_375.png` — 真实产品首页（375×812）
- `cyclebubble_home_real_product_board.png` — 真实首页说明板

### `design/v4-liquid/` — 当前主视觉（液态泡泡）
- `cyclebubble_v4_home_liquid_bubble.png`
- `cyclebubble_v4_cycle_bubble_liquid.png`
- `cyclebubble_v4_emotion_record_minimal.png`
- `cyclebubble_v4_anonymous_resonance_minimal.png`
- `cyclebubble_v4_liquid_bubble_asset.png` — 视觉资产
- `cyclebubble_v4_four_pages_liquid_overview.png` — 四页总览

### `design/preview/` — 早期预览
- `preview-green-pink.jpg` — 早期绿粉主题预览

### `design/review/` — 设计评审
- `cyclebubble_design_review-html/cyclebubble_design_review.html` — 设计评审材料

### `design/renders/` — Playwright 截图脚本输出（`.gitignore`）
- `playwright-2026/` — 最近一次跑的产物（移动端首页 / 桌面产品板）

### `design/scripts/` — 设计辅助脚本
- `render-screenshots.mjs` — Playwright + Edge 截图脚本（输出到 `design/renders/`）

### `design/prototype-archive/v1-html/` — V1 历史原型（`.gitignore`）
- `cyclebubble.html` — V1 单文件页面
- `cyclebubble-standalone.html` — V1 独立版
- `assets/` — V1 图片与图表脚本
- `_shared/` — V1 字体 + ECharts

---

## 文献证据 — `evidence/`

| 文件 | 内容 |
|---|---|
| `literature-curated.json` | 17 篇筛选文献清单 + OA 链接 |
| `feature-evidence-map.html` | 文献 → 功能映射报告（可读） |
| `feature-evidence-map.json` | 同样映射的结构化版本 |
| `papers/` | 已下载 PDF（`.gitignore`） |

---

## 产品说明与规范

| 文件 | 内容 |
|---|---|
| `docs/page_manual.html` | 4 个核心页面的目标、元素、情绪、流程与建议 |

---

## 本地开发

| 文件 | 内容 |
|---|---|
| `dev.bat` | UTF-8 BOM + chcp 65001 + ANSI 颜色，thin wrapper |
| `dev.ps1` | PowerShell 5.1+ 核心逻辑（启动 / 停止 / 状态） |

| 命令 | 行为 |
|---|---|
| `dev.bat`           | 交互菜单（start / stop / restart / status / exit） |
| `dev.bat start`     | 后端（uvicorn :8765）+ 前端（`python -m http.server` :8766） |
| `dev.bat stop`      | 按端口查 PID → kill |
| `dev.bat restart`   | stop + 1.5s + start |
| `dev.bat status`    | 端口 + PID + HTTP `/health` 与 `/docs` 健康探测 |
| `dev.bat help`      | 帮助 |

---

## 后续 PR 合并后增加的内容（当前分支尚无）

- **`backend/alembic/`** 与 **初始迁移文件** — PR #1 数据层可插拔化
- **`backend/tests/`**（50+ 个 pytest 用例） — PR #1 业务逻辑回归保障
- iOS `viewport-fit=cover` + `safe-area-inset-*` 的 styles.css 改动 — PR #2
- 后端 `JWT` 强制、CORS 白名单、`Response.memory_id` FK、`accompanied_count` 修复 — PR #1 Phase 0/1
