"""CycleBubble 后端入口"""
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from config import settings
from routers import auth, memories, resonance, cycle

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


@app.on_event("startup")
def startup():
    init_db()
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
