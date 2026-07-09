"""数据库连接"""
import os
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlmodel import SQLModel, Session, create_engine
from config import settings


def _is_sqlite_url(url: str) -> bool:
    return url.startswith("sqlite")


engine = create_engine(
    settings.database_url,
    echo=False,
    connect_args={"check_same_thread": False}  # SQLite 需要
)


if _is_sqlite_url(settings.database_url):
    @event.listens_for(Engine, "connect")
    def _sqlite_enable_fk(dbapi_connection, connection_record):  # noqa: ANN001
        """SQLite 默认不强制外键——必须在每个新连接打开 PRAGMA。

        不开的话，schema 里的 FOREIGN KEY 约束会被静默忽略，Phase 1 修复
        (Response.memory_id 外键) 在生产路径完全失效。
        """
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def init_db():
    """初始化 schema。

    行为取决于环境变量 ``CB_USE_ALEMBIC``：
    - 未设置 / 0 / false（默认） —— 直接 ``create_all``，保持开箱即用，
      适合本地 demo / 朋友试用场景
    - 设置为 1 / true —— 只校验表是否存在，不自动建表；schema 演进
      完全交给 ``alembic upgrade head`` 管理（生产化部署推荐此模式）

    生产部署应：``export CB_USE_ALEMBIC=1`` + ``alembic upgrade head``。
    """
    use_alembic = os.getenv("CB_USE_ALEMBIC", "").lower() in ("1", "true", "yes")
    if use_alembic:
        # 仅做"表是否存在"健康检查，不自动建表
        # 生产环境应通过 alembic upgrade head 管理 schema 演进
        from sqlalchemy import inspect
        inspector = inspect(engine)
        required = {"user", "memory", "response", "cycle"}
        existing = set(inspector.get_table_names())
        missing = required - existing
        if missing:
            raise RuntimeError(
                f"CB_USE_ALEMBIC=1 但数据库缺少表 {missing}。"
                "请先执行 `alembic upgrade head` 初始化 schema。"
            )
        return
    # 默认 / 演示模式：保持向后兼容，开箱即用
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
