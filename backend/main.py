from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .config import settings
from .database import init_db, demo_engine
from sqlmodel import Session, select
from .models import User, Memory
from .auth import hash_password

DEMO_EMAIL = "demo@cyclebubble.local"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """启动时同时初始化真实库和演示库"""
    from . import models  # 确保模型被注册
    init_db(target="both")
    # 确保演示账号存在
    _ensure_demo_user()
    yield


def _ensure_demo_user():
    """在演示库创建 demo 账号（如果已存在则跳过）。"""
    with Session(demo_engine) as session:
        existing = session.exec(select(User).where(User.email == DEMO_EMAIL)).first()
        if existing:
            return
        u = User(
            email=DEMO_EMAIL,
            nickname="演示用户",
            password_hash=hash_password("demo"),
        )
        session.add(u)
        session.commit()


app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    lifespan=lifespan
)

# CORS 配置：白名单模式 + 不带 credentials
# 浏览器通过 Bearer Token 认证，不依赖 Cookie/credentials
# allow_origins=["*"] + allow_credentials=True 在浏览器规范中是非法且危险的
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Demo-Mode"],
)

# 路由挂载（其他 agent 正在创建这些文件，确保导入正确）
from .routers import auth, cycle, memory, resonance, growth, reports, profile
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(cycle.router, prefix="/api/cycle", tags=["cycle"])
app.include_router(memory.router, prefix="/api/memories", tags=["memories"])
app.include_router(resonance.router, prefix="/api/resonance", tags=["resonance"])
app.include_router(growth.router, prefix="/api/growth", tags=["growth"])
app.include_router(reports.router)  # reports.router 自带 prefix="/api/reports"
app.include_router(profile.router, prefix="/api/profile", tags=["profile"])

@app.get("/")
def root():
    return {"status": "ok", "app": settings.app_name}

@app.get("/api/health")
def health():
    return {"status": "ok"}