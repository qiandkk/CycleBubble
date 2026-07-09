# CycleBubble

CycleBubble 是一款帮助女性理解周期与情绪关系的产品。它不是经期预测工具，也不是冥想或治疗产品；核心价值是帮助用户理解情绪可能从哪里来。

> **项目定位**：原型级演示产品，目标是"跑通主要功能演示 + 为后续升级为成熟产品打好基础"。
> 后续 `qiandkk/CycleBubble` PR #1 已落地的审计基线修复 (Phase 0-4) 是当前代码基线。

## 产品定位

用户打开 CycleBubble 后，第一眼应看到自己的周期状态和情绪线索，而不是产品理念。产品重点包括：

- 当前周期状态
- 情绪倾向解释
- 今日关注点
- 用户个人记录线索
- 匿名共鸣机制

## Demo 核心页面

当前 Demo 建议聚焦 4 个页面：

1. 首页：展示用户当前周期状态与情绪线索
2. 周期泡泡页：解释周期阶段和情绪倾向
3. 情绪记录页：记录当下感受
4. 匿名共鸣页：展示相似感受的匿名回应

## 目录结构

```
.
├── index.html / script.js / styles.css / api.js   前端 (V5 原型,根目录,GitHub Pages 发布源)
├── backend/                                       FastAPI 后端 (api + 数据库 + 测试 + alembic)
├── design/
│   ├── pages/       各页面高保真设计稿 (PNG,375 / 812)
│   ├── overview/    总览 / 板图 / 真实产品首页
│   ├── v4-liquid/   v4 液态视觉系列 (当前主视觉)
│   ├── review/      设计评审材料
│   ├── prototype-archive/
│   │   └── v1-html/ V1 旧版 HTML 原型 + 字体/图表资源(归档参考)
│   ├── preview/     早期预览图
│   └── renders/     Playwright 截图输出 (tools/render-screenshots.mjs 产物)
├── evidence/                                  文献证据
│   ├── literature-curated.json                筛选文献清单 (17 篇)
│   ├── feature-evidence-map.{html,json}       文献证据 → 功能映射
│   └── papers/                                已下载的开放 PDF 文献 (git 忽略)
├── docs/
│   └── page_manual.html                       页面说明书
├── tools/
│   └── render-screenshots.mjs                 设计稿截图脚本 (Playwright + Edge)
├── CONSTITUTION.md                            产品宪法 (最高设计原则,产品所有改动以此为准)
├── PROJECT_SUMMARY.md                         项目完整记录 (V1 → V5 演变与修正)
├── DESIGN_NOTES.md                            视觉与产品原则备忘
├── INDEX.md                                   文件索引(随结构变化更新)
├── youhua.txt                                 项目优化指南(下一步动作提示)
├── .env.example                               后端环境变量模板
└── render.yaml                                Render 部署配置
```

## 设计原则

- 用户第一眼看到自己的数据，而不是产品理念
- 数据是解释依据，不是视觉主角
- 首页回答"我的情绪可能从哪里来"
- 避免科技感、赛博朋克、AI 概念图和玻璃拟态
- 保持温柔、克制、留白和可信赖

## 关于学术论文

`evidence/papers/` 中的学术论文 PDF 不会推送到 GitHub。仓库只保留文献清单和证据映射文件，避免上传论文全文。

## GitHub Pages 部署

本仓库的 GitHub Pages 源是**仓库根目录**（`index.html` 必须在根目录，GH Pages 才能直接访问）。
若之前是从 `/docs` 部署，请到仓库 Settings → Pages 把 Source 改为 `(root)`。

前端代码里所有资源路径（`./script.js` `./styles.css` `./api.js`）都是相对路径，
无论仓库根目录还是 `https://<user>.github.io/<repo>/` 都能正常加载。

## 数据库迁移

后端从 PR #1 起引入 [alembic](https://alembic.sqlalchemy.org/) 做 schema 版本化管理。
当前默认仍走 `backend/database.py:init_db()` 中的 `SQLModel.metadata.create_all()`，
保持开箱即用、不破坏现有 demo 部署；生产化阶段切换 `CB_USE_ALEMBIC=1` 后
schema 演进由 alembic 完全接管。

### 常用命令

```bash
# 1. 自动生成迁移文件（修改 models.py 后）
cd backend
alembic revision --autogenerate -m "describe your change"

# 2. 应用迁移到数据库
alembic upgrade head              # 升到最新
alembic downgrade -1              # 回退一个版本
alembic downgrade base            # 回退到初始（清空所有表）

# 3. 查看当前状态
alembic current
alembic history
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
# 生产环境首次部署 / 升级 schema
export CB_USE_ALEMBIC=1                # 关闭 create_all 自动建表
export CB_DATABASE_URL=postgresql://...  # 或保持 SQLite
alembic upgrade head                   # 由 alembic 全权管理 schema
python -m uvicorn main:app ...
```

未设置 `CB_USE_ALEMBIC` 时，`init_db()` 仍会 `create_all`，适合本地 demo 与朋友试用。

## 测试

```bash
cd backend
CB_JWT_SECRET=test-secret pytest -q
```

当前测试覆盖 50 个用例：
- `cycle_engine` 的周期阶段边界值与置信度分级
- `auth` 的注册 / 登录 / token / 401 路径
- `resonance` 的存在性 + `is_public` 权限校验（Phase 1 修复）
- `memories` 的 `accompanied_count` 方向（Phase 1 修复）

不依赖真实数据库，默认走临时 sqlite。
