# CycleBubble 项目文件索引

> 仓库结构在 `audit remediation PR #1` 后由扁平化过渡到 `design/ evidence/ docs/` 分层。
> 本索引反映最新结构。

## 前端 (V5 原型 — GitHub Pages 发布源,根目录)

| 文件 | 内容 |
|---|---|
| `index.html` | V5 渲染入口 (5 屏 SPA:首页 / 记录 / 理解 / 成长 / 回应) |
| `script.js` | V5 状态机 + Bubble SVG 液体波浪 + AI 抽取编排 |
| `styles.css` | 颜色变量 + 玻璃/液体/纹理层叠样式 |
| `api.js` | 后端 HTTP 客户端,localStorage 存储 JWT,Render URL 自动适配 |

## 后端 `backend/`

| 文件 | 内容 |
|---|---|
| `main.py` | FastAPI 入口,CORS 中间件,`/` `/api/health` 健康检查 |
| `config.py` | `Settings` (pydantic-settings) + CB_JWT_SECRET/CORS/DATABASE_URL |
| `auth.py` | `pbkdf2_sha256` 哈希 + JWT 签发 + `get_current_user` 依赖 |
| `database.py` | SQLModel engine + SQLite PRAGMA foreign_keys=ON + `init_db` |
| `models.py` | `User` `Memory` `Response` `Cycle` 四张表,Response.memory_id FK |
| `routers/auth.py` | `/api/auth/register` `/api/auth/login` `/api/auth/me` |
| `routers/memories.py` | CRUD + AI 抽取 + Pattern + Bubble 状态 + 成长页 |
| `routers/resonance.py` | 共鸣 feed + 回应 (含存在性 + is_public 校验) |
| `routers/cycle.py` | 经期开始 / 周期状态 |
| `cycle_engine.py` | 周期阶段 + 置信度计算 (独立纯函数模块) |
| `patterns.py` | Pattern 聚合 + Bubble 视觉状态计算 |
| `ai_agent.py` | DeepSeek 客户端 + 回退抽取 (无 key 时) |
| `alembic/` | 迁移目录,初始迁移覆盖 4 张表 + FK |
| `alembic.ini` | alembic 配置,`sqlalchemy.url` 留空(env 注入) |
| `tests/` | 50 个 pytest 用例(conftest + 4 个测试模块) |
| `pytest.ini` | pytest 配置 |
| `requirements.txt` | 依赖清单(alembic + passlib + pytest) |

## 设计资产 `design/`

### `design/pages/` — 单页高保真
- `cyclebubble_page_cycle_bubble_hifi.png` 周期泡泡页高保真稿
- `cyclebubble_page_emotion_record_hifi.png` 情绪记录页高保真稿
- `cyclebubble_page_anonymous_resonance_hifi.png` 匿名共鸣页高保真稿

### `design/overview/` — 总览 / 板图 / 真实产品首页
- `cyclebubble_three_core_pages_hifi.png` 三个核心页面总览图
- `cyclebubble_home_real_product_375.png` 最新首页设计稿,375 / 812 真实产品首页布局
- `cyclebubble_home_real_product_board.png` 最新首页设计说明版

### `design/v4-liquid/` — 当前主视觉(液态泡泡)
- `cyclebubble_v4_home_liquid_bubble.png` 首页液态泡泡版
- `cyclebubble_v4_cycle_bubble_liquid.png` 周期泡泡页液体面表达周期进度
- `cyclebubble_v4_emotion_record_minimal.png` 情绪记录页极简书写
- `cyclebubble_v4_anonymous_resonance_minimal.png` 匿名共鸣页去社交化卡片
- `cyclebubble_v4_liquid_bubble_asset.png` 液体泡泡视觉资产
- `cyclebubble_v4_four_pages_liquid_overview.png` 四页面总览(液态)

### `design/review/` — 设计评审
- `cyclebubble_design_review-html-v1/cyclebubble_design_review.html` 设计评审记录

### `design/preview/` — 早期预览
- `preview-green-pink.jpg` 早期绿粉主题预览

### `design/prototype-archive/v1-html/` — V1 历史原型(归档)
- `cyclebubble.html` 原 V1 单文件页面
- `cyclebubble-standalone.html` 独立版 V1
- `assets/` 原页面图片与图表
- `_shared/` 字体(Instrument Sans/Serif)+ ECharts

### `design/renders/cyclebubble-screenshots-2026/` — 截图脚本产物
- `cyclebubble-home-mobile.png` 移动端首页(390x900 @2x)
- `cyclebubble-product-board.png` 桌面产品板(1440x1400)
- 由 `tools/render-screenshots.mjs` 生成

## 文献证据 `evidence/`

| 文件 | 内容 |
|---|---|
| `literature-curated.json` | 17 篇筛选文献清单,带 OA 链接 |
| `feature-evidence-map.html` | 文献 → 功能映射报告(可读) |
| `feature-evidence-map.json` | 同样映射的结构化版本 |
| `papers/` | 已下载 PDF (gitignored) |

## 产品说明与规范

| 文件 | 内容 |
|---|---|
| `README.md` | 项目入口 + 目录结构 + 部署 + 测试 + 迁移指南 |
| `docs/page_manual.html` | 4 个核心页面的目标、元素、情绪、流程与建议 |
| `CONSTITUTION.md` | 产品宪法(V2),所有改动以此为准 |
| `PROJECT_SUMMARY.md` | 完整演变记录(V1→V5 + 修正史) |
| `DESIGN_NOTES.md` | 视觉与产品原则备忘 |
| `youhua.txt` | 优化指南(下一步动作提示) |

## 部署与脚本

| 文件 | 内容 |
|---|---|
| `.env.example` | 环境变量模板(CB_JWT_SECRET / DEEPSEEK_API_KEY / CB_CORS_ORIGINS / CB_DATABASE_URL) |
| `render.yaml` | Render 服务定义,Web 服务自动生成 CB_JWT_SECRET |
| `tools/render-screenshots.mjs` | Playwright + Edge 截图脚本,产物输出到 `design/renders/` |

## 已清理内容

- 删除 `temp_body.json` (GitHub API commit payload 残留)
- 删除 `docs/` 副本(与根目录完全重复,Phase 3 已删)
