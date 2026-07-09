"""数据模型 — User / Memory / Response

Memory 的结构化字段与前端 extractMemory() 输出形状对齐，
这样前端 computePatterns() / computeBubbleState() 无需修改。
"""
import uuid
from datetime import datetime, timezone
from typing import Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON, Text


def utcnow():
    return datetime.utcnow()


def gen_id():
    return str(uuid.uuid4())


class User(SQLModel, table=True):
    id: str = Field(default_factory=gen_id, primary_key=True)
    email: str = Field(index=True, unique=True)
    password_hash: str
    nickname: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)
    last_active_at: datetime = Field(default_factory=utcnow)


class Memory(SQLModel, table=True):
    """一条情绪记录 = 一条 Memory，核心表"""
    id: str = Field(default_factory=gen_id, primary_key=True)
    user_id: str = Field(index=True)

    # 原文
    raw_text: str
    snippet: str  # 截断展示（>50 字加省略号）

    created_at: datetime = Field(default_factory=utcnow, index=True)

    # —— LLM 抽取的结构化字段（JSON 存储兼容 SQLite）——
    themes: list = Field(default=[], sa_column=Column(JSON))
    event: Optional[str] = Field(default=None, sa_column=Column(Text))
    objects: list = Field(default=[], sa_column=Column(JSON))
    triggers: list = Field(default=[], sa_column=Column(JSON))
    recovery: list = Field(default=[], sa_column=Column(JSON))
    emotions: list = Field(default=[], sa_column=Column(JSON))  # [{"name":"焦虑","intensity":3}]
    expression_style: Optional[str] = None  # 倾诉/反思/提问/宣泄/行动
    has_action: bool = False

    # 派生字段（从 emotions 计算，方便查询）
    mood: Optional[str] = None  # 主导情绪

    # 社区
    is_public: bool = False
    source: str = "self"  # self / community

    # LLM 原始返回（调试用）
    llm_raw: Optional[dict] = Field(default=None, sa_column=Column(JSON))


class Response(SQLModel, table=True):
    """回应 = 社区有限表达"""
    id: str = Field(default_factory=gen_id, primary_key=True)
    responder_id: str = Field(index=True)
    # 数据库层外键兜底，禁止写入指向不存在 memory 的脏数据
    memory_id: str = Field(index=True, foreign_key="memory.id")
    response_type: str  # empathy / thanks / hug / share
    content: Optional[str] = None  # 仅 share 类型有内容
    created_at: datetime = Field(default_factory=utcnow)


class Cycle(SQLModel, table=True):
    """经期周期记录 — 每条对应一次经期开始

    周期长度由相邻两次 period_start 的间隔倒推，经期结束日期可选。
    datetime 统一使用 naive UTC（与 User/Memory 保持一致）。
    """
    id: str = Field(default_factory=gen_id, primary_key=True)
    user_id: str = Field(index=True)
    period_start: datetime  # 经期开始日期（naive UTC）
    period_end: Optional[datetime] = None  # 经期结束日期（可选）
    cycle_length: Optional[int] = None  # 该周期长度（天），由相邻两次开始日期计算
    created_at: datetime = Field(default_factory=utcnow)


class Report(SQLModel, table=True):
    """用户对共鸣 Memory 的举报 — 用于最小化内容治理。

    隐私设计：
    - ``reason`` 由前端下拉选择（spam / harassment / self_harm_concern / other），
      不存用户原话避免再次伤害
    - ``status`` 由后续人工 / 自动审核流转，原型阶段保持 'open'
    - 同一用户对同一 memory 只记一条（去重）
    """
    id: str = Field(default_factory=gen_id, primary_key=True)
    reporter_id: str = Field(index=True)              # 举报人
    memory_id: str = Field(index=True, foreign_key="memory.id")
    reason: str  # spam / harassment / self_harm_concern / other
    note: Optional[str] = Field(default=None, sa_column=Column(Text))  # 可选补充说明
    status: str = Field(default="open")  # open / reviewed / dismissed
    created_at: datetime = Field(default_factory=utcnow)

