"""管理员设置服务

读取顺序：DB 覆盖值 → 环境变量 → 默认值。
不在 env / DB 中存在的 key 启动时把 env 默认值写入 DB 一次。
"""
from typing import Optional
from datetime import datetime
from sqlmodel import Session, select

from ..models import AdminSetting
from ..database import real_engine
from ..config import settings


# 已知 key
KEY_ENABLE_THIRD_PARTY = "enable_third_party_ai"
KEY_ENABLE_KEYWORD_FALLBACK = "enable_keyword_fallback"
KEY_MINIMAX_KEY = "minimax_api_key"
KEY_DEEPSEEK_KEY = "deepseek_api_key"
KEY_DEFAULT_PROVIDER = "default_provider"
KEY_DEFAULT_MODEL_MINIMAX = "default_model:minimax"
KEY_DEFAULT_MODEL_DEEPSEEK = "default_model:deepseek"


def _seed_defaults() -> None:
    """把环境变量默认值写入 DB 一次（如果 DB 中没有）。"""
    defaults = {
        KEY_ENABLE_THIRD_PARTY: "true",
        KEY_ENABLE_KEYWORD_FALLBACK: "true",
        KEY_DEFAULT_PROVIDER: settings.ai_default_provider,
        KEY_DEFAULT_MODEL_MINIMAX: settings.ai_default_model_minimax,
        KEY_DEFAULT_MODEL_DEEPSEEK: settings.ai_default_model_deepseek,
    }
    with Session(real_engine) as session:
        for key, value in defaults.items():
            existing = session.get(AdminSetting, key)
            if existing is None:
                session.add(AdminSetting(
                    key=key,
                    value=value,
                    updated_at=datetime.utcnow(),
                    updated_by="system",
                ))
            else:
                # 修复旧数据库中默认值缺失的字段
                if existing.value in (None, "") and key in (
                    KEY_ENABLE_THIRD_PARTY, KEY_ENABLE_KEYWORD_FALLBACK,
                ):
                    existing.value = value
                    existing.updated_at = datetime.utcnow()
                    existing.updated_by = "system-repair"
        session.commit()


def init_settings_from_env() -> None:
    """启动钩子：把默认值写入 DB。"""
    _seed_defaults()


def get_setting(key: str, default: Optional[str] = None) -> Optional[str]:
    """DB 覆盖值优先，缺失时返回 default。"""
    with Session(real_engine) as session:
        row = session.get(AdminSetting, key)
        if row is not None:
            return row.value
    return default


def get_int(key: str, default: int) -> int:
    v = get_setting(key)
    if v is None or v == "":
        return default
    try:
        return int(v)
    except (TypeError, ValueError):
        return default


def get_bool(key: str, default: bool) -> bool:
    v = get_setting(key)
    if v is None:
        return default
    return str(v).strip().lower() in ("1", "true", "yes", "on")


def set_setting(key: str, value: str, updated_by: str = "admin") -> None:
    with Session(real_engine) as session:
        row = session.get(AdminSetting, key)
        if row is None:
            session.add(AdminSetting(
                key=key,
                value=value,
                updated_at=datetime.utcnow(),
                updated_by=updated_by,
            ))
        else:
            row.value = value
            row.updated_at = datetime.utcnow()
            row.updated_by = updated_by
        session.commit()


def mask_api_key(value: str) -> str:
    """脱敏显示 Key：xxxx****xxxx"""
    if not value:
        return ""
    if len(value) <= 8:
        return "*" * len(value)
    return value[:4] + "*" * (len(value) - 8) + value[-4:]