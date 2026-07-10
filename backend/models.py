from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime, date

class User(SQLModel, table=True):
    __tablename__ = "user"
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True, max_length=255)
    password_hash: str = Field(max_length=255)
    nickname: Optional[str] = Field(default=None, max_length=50)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_active_at: Optional[datetime] = Field(default=None)

    cycles: List["Cycle"] = Relationship(back_populates="user")
    memories: List["Memory"] = Relationship(back_populates="user")

class Cycle(SQLModel, table=True):
    __tablename__ = "cycle"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    start_date: date
    end_date: Optional[date] = Field(default=None)
    flow: Optional[str] = Field(default=None, max_length=20)  # 'light' | 'medium' | 'heavy'
    source: str = Field(default="manual", max_length=20)  # 'manual' | 'manyou' | 'apple_health'
    created_at: datetime = Field(default_factory=datetime.utcnow)

    user: Optional[User] = Relationship(back_populates="cycles")

class Memory(SQLModel, table=True):
    __tablename__ = "memory"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    raw_text: str = Field(max_length=2000)
    themes: str = Field(default="[]", max_length=500)  # JSON array
    triggers: str = Field(default="[]", max_length=500)
    recovery: str = Field(default="[]", max_length=500)
    emotions: str = Field(default="[]", max_length=500)  # JSON array of {name, intensity}
    mood: str = Field(default="", max_length=50)
    is_public: bool = Field(default=False, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)

    user: Optional[User] = Relationship(back_populates="memories")
    responses: List["Response"] = Relationship(back_populates="memory")

class Response(SQLModel, table=True):
    __tablename__ = "response"
    id: Optional[int] = Field(default=None, primary_key=True)
    # 注意：FK 强约束依赖 database.py 里 PRAGMA foreign_keys=ON
    memory_id: int = Field(foreign_key="memory.id", index=True)
    user_id: int = Field(foreign_key="user.id", index=True)
    type: str = Field(max_length=20)  # '我也经历过'|'谢谢'|'抱抱'|'继续说'|'分享我的经历'
    content: Optional[str] = Field(default=None, max_length=500)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    memory: Optional[Memory] = Relationship(back_populates="responses")

class Report(SQLModel, table=True):
    __tablename__ = "report"
    id: Optional[int] = Field(default=None, primary_key=True)
    memory_id: int = Field(foreign_key="memory.id", index=True)
    reporter_user_id: int = Field(foreign_key="user.id", index=True)
    reason: str = Field(max_length=30)  # spam/harassment/self_harm_concern/other
    note: Optional[str] = Field(default=None, max_length=500)
    status: str = Field(default="open", max_length=20)  # open/reviewed/dismissed
    created_at: datetime = Field(default_factory=datetime.utcnow)