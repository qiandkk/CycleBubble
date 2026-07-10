from sqlmodel import SQLModel, Session, create_engine
from sqlalchemy import event
from sqlalchemy.engine import Engine
from .config import settings


def _is_sqlite(url: str) -> bool:
    return url.startswith("sqlite")


# 注意：SQLite 的 PRAGMA foreign_keys 是连接级设置，每个新连接都要重新开启。
# 不能在 create_engine 之后只执行一次，必须用 connect 事件监听器。
if _is_sqlite(settings.database_url):
    @event.listens_for(Engine, "connect")
    def _enable_sqlite_fk(dbapi_connection, connection_record):
        """每个新 SQLite 连接都启用外键约束。

        用户数据敏感（情绪/经期/健康），必须保证数据库层 FK 强约束，
        防止 Response.memory_id 写入指向不存在 memory 的脏数据。
        """
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


engine = create_engine(
    settings.database_url,
    echo=False,
    connect_args={"check_same_thread": False} if _is_sqlite(settings.database_url) else {}
)


def init_db():
    """创建所有表"""
    # 注意：models.py 的导入需要在这里发生，但这里不能直接导入避免循环
    # 我们将在 main.py 的 startup 事件中调用此函数并先 import models
    SQLModel.metadata.create_all(engine)


def get_session():
    """FastAPI 依赖：每次请求一个 Session"""
    with Session(engine) as session:
        yield session
