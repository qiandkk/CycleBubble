"""数据库基础设施

设计：双数据库架构
- real_engine → cyclebubble.db （真实用户数据）
- demo_engine → cyclebubble_demo.db （演示数据，完全隔离）

每个引擎独立启用 SQLite 外键约束。
"""
from typing import Optional
from fastapi import Request
from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy import event
from sqlalchemy.engine import Engine
from .config import settings


def _is_sqlite(url: str) -> bool:
    return url.startswith("sqlite")


def _enable_sqlite_fk(dbapi_connection, connection_record):
    """每个新 SQLite 连接都启用外键约束。"""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


# PRAGMA foreign_keys 是连接级设置，必须在每个连接上重新开启。
# 用 listen_for(Engine, "connect") 一次性注册，所有 engine 实例共享。
event.listens_for(Engine, "connect")(_enable_sqlite_fk)


def _make_engine(url: str) -> Engine:
    return create_engine(
        url,
        echo=False,
        connect_args={"check_same_thread": False} if _is_sqlite(url) else {},
    )


# 真实数据库（默认）
real_engine = _make_engine(settings.database_url)


# 演示数据库（独立 URL，规则：原 URL 末尾插入 _demo）
# 例如 sqlite:///./cyclebubble.db → sqlite:///./cyclebubble_demo.db
# 例如 sqlite:///./data/cyclebubble.db → sqlite:///./data/cyclebubble_demo.db
def _derive_demo_url(real_url: str) -> str:
    """从真实库 URL 推导演示库 URL：在路径末尾（不含扩展名前）插入 _demo"""
    # 找到最后一个 '/' 和最后一个 '.'
    last_slash = real_url.rfind("/")
    last_dot = real_url.rfind(".")
    if last_dot == -1 or last_dot < last_slash:
        # 没有扩展名：直接拼 _demo
        return real_url + "_demo"
    return real_url[:last_dot] + "_demo" + real_url[last_dot:]


demo_database_url = settings.demo_database_url or _derive_demo_url(settings.database_url)
demo_engine = _make_engine(demo_database_url)


def init_db(target: str = "real"):
    """创建表。

    target:
      - "real"   只初始化真实库
      - "demo"   只初始化演示库
      - "both"   两个都初始化（首次启动）
    """
    from . import models  # 确保模型被注册

    if target in ("real", "both"):
        SQLModel.metadata.create_all(real_engine)
    if target in ("demo", "both"):
        SQLModel.metadata.create_all(demo_engine)


def _is_demo_request(request: Request) -> bool:
    """根据请求头判断是否演示模式。

    前端在演示模式下会在所有请求加 X-Demo-Mode: 1。
    """
    if request is None:
        return False
    return request.headers.get("X-Demo-Mode", "").strip() == "1"


def get_session(request: Request):
    """FastAPI 依赖：根据 X-Demo-Mode header 自动选择 session。

    - X-Demo-Mode: 1 → 演示库（demo 账号预置种子，无登录可读）
    - 其他        → 真实库（必须登录）
    """
    engine = demo_engine if _is_demo_request(request) else real_engine
    with Session(engine) as session:
        yield session


def get_real_session():
    """强制返回真实库 session（用于需要双库读写的场景，例如 demo 种子初始化）"""
    with Session(real_engine) as session:
        yield session


def get_demo_session():
    """强制返回演示库 session"""
    with Session(demo_engine) as session:
        yield session
