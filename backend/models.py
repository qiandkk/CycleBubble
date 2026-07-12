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
    is_sensitive: bool = Field(default=False, index=True)
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


class AdminSetting(SQLModel, table=True):
    """管理员设置键值表

    key: 配置项
    value: 配置值（字符串）
    updated_at: 修改时间
    updated_by: 修改者（admin username）
    """
    __tablename__ = "admin_setting"
    key: str = Field(primary_key=True, max_length=64)
    value: str = Field(max_length=2000)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    updated_by: str = Field(default="", max_length=64)


class AdminLoginAttempt(SQLModel, table=True):
    """管理员登录尝试事件表（纯事件，无聚合字段）"""
    __tablename__ = "admin_login_attempt"
    id: Optional[int] = Field(default=None, primary_key=True)
    username: str = Field(index=True, max_length=64)
    ip: str = Field(index=True, max_length=64)
    success: bool = Field(default=False)
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)


class UserLoginAttempt(SQLModel, table=True):
    """普通用户登录尝试事件表（防暴力破解）

    用 key 字段（email 或 ip）区分两类限速：
    - key=email：同一个邮箱连续失败 → 锁账号
    - key=ip：同一个 IP 跨账号连续失败 → 锁 IP（防恶意扫号）
    """
    __tablename__ = "user_login_attempt"
    id: Optional[int] = Field(default=None, primary_key=True)
    key: str = Field(index=True, max_length=255)  # email 或 ip
    kind: str = Field(index=True, max_length=16)  # 'email' | 'ip'
    success: bool = Field(default=False)
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)


class AdminAudit(SQLModel, table=True):
    """管理员操作审计日志"""
    __tablename__ = "admin_audit"
    id: Optional[int] = Field(default=None, primary_key=True)
    admin_username: str = Field(index=True, max_length=64)
    action: str = Field(max_length=64)
    target: str = Field(max_length=128)
    ip: str = Field(max_length=64)
    ua: str = Field(max_length=256)
    reason: Optional[str] = Field(default=None, max_length=500)
    timestamp: datetime = Field(default_factory=datetime.utcnow, index=True)


class AdminMemoryAccessToken(SQLModel, table=True):
    """一次性记忆访问令牌（管理员审计）"""
    __tablename__ = "admin_memory_access_token"
    id: str = Field(primary_key=True, max_length=64)  # uuid
    admin_username: str = Field(index=True, max_length=64)
    memory_id: int = Field(foreign_key="memory.id", index=True)
    reason: str = Field(max_length=500)
    expires_at: datetime = Field(index=True)
    used_at: Optional[datetime] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)