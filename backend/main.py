"""CycleBubble 后端入口"""
import os
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select
from database import init_db, engine
from config import settings
from models import User
from auth import hash_password
from routers import auth, memories, resonance, cycle, reports

app = FastAPI(title="CycleBubble API", version="1.0.0")

# CORS —— 显式白名单，且不依赖浏览器凭证传递 token（前端用
# Authorization: Bearer 头），因此关闭 allow_credentials 进一步收窄攻击面。
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 路由
app.include_router(auth.router)
app.include_router(memories.router)
app.include_router(resonance.router)
app.include_router(cycle.router)
app.include_router(reports.router)


# 本地演示账号 — 仅在显式启用时创建/刷新
# 启用方式：CB_DEMO_USER=1 (默认开启以便开发)
# 关闭方式：CB_DEMO_USER=0
DEMO_EMAIL    = "demo"
DEMO_PASSWORD = "demo"
DEMO_NICKNAME = "演示用户"


def _ensure_demo_user():
    """在本地开发库里确保有一个 demo 账号存在，方便随时登录测试。
    仅在 CB_DEMO_USER != '0' 时生效（默认开启）。"""
    if os.getenv("CB_DEMO_USER", "1") == "0":
        return
    with Session(engine) as session:
        existing = session.exec(
            select(User).where(User.email == DEMO_EMAIL)
        ).first()
        if existing:
            print(f"[CycleBubble] Demo 账号已存在: {DEMO_EMAIL}")
            return
        u = User(
            email=DEMO_EMAIL,
            nickname=DEMO_NICKNAME,
            password_hash=hash_password(DEMO_PASSWORD),
        )
        session.add(u)
        session.commit()
        print(f"[CycleBubble] Demo 账号已创建: {DEMO_EMAIL}  /  密码: {DEMO_PASSWORD}")


@app.on_event("startup")
def startup():
    init_db()
    _ensure_demo_user()
    print(f"[CycleBubble] 数据库已初始化")
    print(f"[CycleBubble] DeepSeek API Key: {'已配置' if settings.deepseek_api_key else '未配置（使用回退抽取）'}")


@app.get("/")
def health():
    return {"status": "ok", "service": "CycleBubble API"}


@app.get("/api/health")
def api_health():
    return {"status": "ok"}


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
