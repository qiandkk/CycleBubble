"""Alembic 环境配置

- ``target_metadata`` 指向 SQLModel.metadata（与 backend/models.py 中的 4 张表绑定）
- 数据库 URL 从 ``backend/database.py:settings`` 读，单一来源；
  这样 ``CB_DATABASE_URL`` 环境变量切换 SQLite / Postgres 时 alembic 自动跟随
- 对 SQLite，String 类型的 length 走 alembic 默认非显式渲染，
  避免与 SQLModel.metadata 中 ``String()``（无 length）的差异触发
  ``compare_type`` 误报（Phase 2 验收要求 schema 与 ``create_all`` 一致）
"""
import os
import sys
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# 让 alembic 能 import backend 下的包（database / models）
HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND_ROOT = os.path.dirname(HERE)
if BACKEND_ROOT not in sys.path:
    sys.path.insert(0, BACKEND_ROOT)

# 必须在 sys.path 调整之后再 import
from sqlmodel import SQLModel  # noqa: E402

# 触发 models 注册到 SQLModel.metadata
import models  # noqa: E402, F401
from database import settings as cb_settings  # noqa: E402

# Alembic Config —— 提供 .ini 文件访问
config = context.config

# 用 backend 的 settings 覆盖 alembic.ini 里的 sqlalchemy.url
# render_as_item=False 让 alembic 把它作为普通字符串读，
# 在 SQLite 之类没有真实 driver 的环境也能工作
config.set_main_option("sqlalchemy.url", cb_settings.database_url)

# 解释 .ini 的 logging 配置
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# SQLModel.metadata 中已注册 user / memory / response / cycle 4 张表
target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    """离线模式 —— 只用 URL，不创建 Engine。"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,  # SQLite ALTER TABLE 兼容
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """在线模式 —— 创建 Engine 跑迁移。"""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,  # SQLite ALTER TABLE 兼容
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
