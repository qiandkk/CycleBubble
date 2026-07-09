# CycleBubble

> 一个持续理解你的情绪空间。

CycleBubble 是一款帮助女性理解**周期与情绪关系**的产品。它不是经期预测工具，也不是冥想或治疗产品；核心价值是帮助用户理解情绪**可能从哪里来**。

**项目主页（GitHub Pages）**：<https://qiandkk.github.io/CycleBubble/>

**Demo 后端**：<https://cyclebubble-api.onrender.com>（Render 免费实例，DB 是临时 SQLite，重启即清空）

---

## 这是什么 / 给谁用

| 角色 | 想知道什么 | 看哪里 |
|---|---|---|
| 第一次来的访客 | 这是什么产品？怎么跑？ | 本文「快速开始」一节，2 分钟内能跑起来 |
| 准备贡献代码 | 项目结构 / 跑测试 / 提 PR | 「目录结构」+「测试」+「路线图」 |
| 想了解产品定位 | 为什么要做？目标用户是谁？ | [`docs/CONSTITUTION.md`](docs/CONSTITUTION.md) |
| 看历史迭代 | 从 V1 到 V5 怎么演变的？ | [`docs/PROJECT_SUMMARY.md`](docs/PROJECT_SUMMARY.md) |
| 找某个文件 | 文件在哪、干什么 | [`docs/INDEX.md`](docs/INDEX.md) |
| 设计师 | 视觉规范、页面结构 | [`docs/page_manual.html`](docs/page_manual.html) + [`docs/DESIGN_NOTES.md`](docs/DESIGN_NOTES.md) |

---

## 快速开始

需要：Python 3.10+、Git Bash（Windows）或任意 shell（mac/Linux）

```bash
git clone https://github.com/qiandkk/CycleBubble.git
cd CycleBubble
./dev.bat           # Windows；或 powershell -File dev.ps1
# → 菜单选 1（start）
# → 浏览器打开 http://127.0.0.1:8766/
# → 点「快速体验」按钮一键登入 demo 账号
```

如果你没在交互菜单，命令式用法：

```bash
dev.bat start     # 起后端 :8765 + 前端 :8766
dev.bat status    # 看端口/PID/HTTP 健康
dev.bat stop      # 全部停掉
dev.bat restart   # 重启
```

**测试账号**（后端 startup 自动注入到本地 SQLite，**仅本地**，不会出现在 Render 部署）：

| 字段 | 值 |
|---|---|
| 账号 | `demo` |
| 密码 | `demo` |

要关掉自动注入？`CB_DEMO_USER=0 dev.bat start`。

---

## 端口与访问

| 端口 | 服务 | 怎么用 |
|---|---|---|
| `:8765` | 后端 FastAPI（uvicorn） | 前端 JS 自动连；浏览器看不到 |
| `:8766` | 前端（`python -m http.server`，根目录是 `frontend/`） | **直接进** CycleBubble SPA |

API 文档（后端自带）：`http://127.0.0.1:8765/docs`

---

## 产品定位

用户打开 CycleBubble 后，第一眼应看到自己的周期状态和情绪线索，而不是产品理念：

- 当前周期状态
- 情绪倾向解释
- 今日关注点
- 用户个人记录线索
- 匿名共鸣机制

5 屏 SPA：

| 屏 | 路由 | 内容 |
|---|---|---|
| 登录 | `data-screen="auth"` | 登录 / 注册 / 快速体验 |
| 经期引导 | `data-screen="onboard"` | 首次注册时填经期信息 |
| 今日 | `data-screen="home"` | Bubble 实时染色 + 周期状态 + CTA |
| 记录 | `data-screen="record"` | textarea + 静置动画 + 反思文本 |
| 成长 | `data-screen="growth"` | 记忆时间线 + Pattern 卡片 |
| 回应 | `data-screen="resonance"` | 共鸣 feed + 4 种回应 chip |

> 完整页面规范见 [`docs/page_manual.html`](docs/page_manual.html)。

### Signature 元素：Bubble 实时染色

`script.js` 把最近 7 天的情绪（焦虑 / 愤怒 / 委屈 / 低落 / 平静 / 温暖 / 力量）按 intensity 加权映射到 HSL，再注入 CSS 变量 `--bubble-hue` / `--bubble-water-hue` 给所有 `.bubble` 实例。玻璃面、液体、波纹全部跟随情绪变色——这是产品宪法「V6 Settling, not Growing」埋下的隐喻，本次真正做出来。

---

## 目录结构

```
.
├── README.md                ← 本文件（项目入口）
│
├── frontend/                ← GH Pages 发布源（5 屏 SPA）
│   ├── index.html             入口
│   ├── styles.css             Token + 组件样式 (含 iOS 安全区)
│   ├── script.js              状态机 + Bubble 实时染色 + 全屏编排
│   └── api.js                 后端 HTTP 客户端
│
├── docs/                    ← 全部产品文档集中地
│   ├── INDEX.md               文件索引
│   ├── CONSTITUTION.md        产品宪法（最高设计原则）
│   ├── PROJECT_SUMMARY.md     V1→V5 演变与修正记录
│   ├── DESIGN_NOTES.md        视觉与产品原则备忘（英文）
│   └── page_manual.html       4 个核心页面的目标/元素/情绪/流程
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
├── design/                  ← 设计资产（PNG / HTML）
├── evidence/                ← 文献证据（17 篇筛选清单 + 映射）
│
├── .github/workflows/ci.yml ← CI (backend / frontend / layout 3 jobs)
├── render.yaml              ← Render 服务定义
├── .env.example             ← 环境变量模板
└── .gitignore
```

> 想找某个文件的具体角色？看 [`docs/INDEX.md`](docs/INDEX.md)。

---

## 设计原则

- 用户第一眼看到自己的数据，而不是产品理念
- 数据是解释依据，不是视觉主角
- 首页回答"我的情绪可能从哪里来"
- 避免科技感、赛博朋克、AI 概念图和玻璃拟态
- 保持温柔、克制、留白和可信赖

完整原则见 [`docs/CONSTITUTION.md`](docs/CONSTITUTION.md)。

---

## GitHub Pages 部署

本仓库的 GH Pages 源是 **`frontend/` 子目录**。

1. 打开 https://github.com/qiandkk/CycleBubble/settings/pages
2. **Source** = `Deploy from a branch`
3. **Branch** = `master`
4. **Folder** = **`/frontend`** ← 必须是这个

merge 到 master 后前端自动发布。后续前端改动只改 `frontend/`，根目录不再有副本。

---

## 本地开发（细节）

`dev.bat`（UTF-8 BOM + `chcp 65001` + ANSI 颜色）是 thin wrapper，把重活委托给 `dev.ps1`（PowerShell 5.1+）。Windows 上 PowerShell 对后台进程 + IO 重定向更可靠。

`dev.ps1` 做的事：
- 后端：`python -m uvicorn main:app --host 127.0.0.1 --port 8765 --app-dir backend`
- 前端：`python -m http.server 8766 --bind 127.0.0.1` 工作目录 = `frontend/`
- dev 默认值（`CB_JWT_SECRET`、`CB_CORS_ORIGINS`）已硬编码，**本地开发不需要复制 `.env.example`**
- 日志按 2 MB 自动轮转，保留 3 代

**幂等**：`dev.bat stop` 按端口查 PID kill，不会跟其他 Python 进程打架。

### 测试

```bash
cd backend
CB_JWT_SECRET=test-secret pytest -q
```

测试覆盖（50+ 个用例）：
- `cycle_engine` 的周期阶段边界值与置信度分级
- `auth` 的注册 / 登录 / token / 401 路径
- `resonance` 的存在性 + `is_public` 权限校验
- `memories` 的 `accompanied_count` 方向

不依赖真实数据库，默认走临时 sqlite。

---

## 数据库迁移 (alembic)

后端用 [alembic](https://alembic.sqlalchemy.org/) 做 schema 版本化管理。
当前默认走 `backend/database.py:init_db()` 的 `SQLModel.metadata.create_all()`，开箱即用；
生产化阶段切 `CB_USE_ALEMBIC=1` 后由 alembic 完全接管。

```bash
cd backend
alembic revision --autogenerate -m "describe your change"
alembic upgrade head              # 升到最新
alembic downgrade -1              # 回退一个版本
alembic downgrade base            # 回退到初始（清空所有表）
alembic current / history
```

切数据库：

```bash
export CB_DATABASE_URL=postgresql://user:pass@host:5432/cyclebubble
alembic upgrade head
python -m uvicorn main:app ...
```

业务代码无需任何改动。

---

## CI

`.github/workflows/ci.yml` 三个 job：

| Job | 内容 |
|---|---|
| `backend` | Python 3.12 编译 + import smoke + pytest |
| `frontend` | HTML 严格解析（stdlib parser）+ `node --check` JS 语法 |
| `repo layout` | 防 temp_body.json / docs/ 旧副本回归 + index.html 引用路径存在性 + cache-bust 兼容 |

触发：push 到 master + 任何 PR。`cancel-in-progress` 自动取消同分支旧 run 节省 CI 分钟。

---

## 路线图 — 已合并 PR

| PR | 标题 | 关键改动 |
|---|---|---|
| #1 | 审计 4 Phase 重构 | JWT 强制 + CORS 白名单 + alembic + 50+ 测试 |
| #2 | iOS 适配 | `viewport-fit=cover` + safe-area + tap-highlight |
| #3 | 整合前端 + dev.bat | frontend/ 目录化 + 本地一键启停（中文化） |
| #4 | 前端整体重设计 + Bubble 实时染色 | frontend-design 流程 + 签名元素 + 完整健壮性打磨 |
| #5 | 前端迁 frontend/ + dev 直进 + CORS + 文档归类 | frontend/ 子目录、`:8766/` 直进、cors 解析修、4 文档归 docs/、CI 适配 |

---

## 关于学术论文

`evidence/papers/` 中的 PDF 不会推送到 GitHub（`.gitignore`）。仓库只保留文献清单和证据映射文件，避免上传论文全文。

---

## 想要贡献？

1. Fork → 改 → PR 到 `master` 分支
2. CI 会自动跑（编译 / HTML 解析 / JS 语法 / repo layout / pytest）
3. PR 标题建议遵循 [Conventional Commits](https://www.conventionalcommits.org/)：`feat:` / `fix:` / `refactor:` / `chore:`
4. 前端改动只动 `frontend/`，后端改动只动 `backend/`，文档改动只动 `docs/`
5. **不要**把 demo 账号推上 Render（密码是写死的）

## License

未声明。所有权归原作者。