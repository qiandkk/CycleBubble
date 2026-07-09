"""CycleBubble 后端配置

环境变量统一通过 ``CB_`` 前缀注入到 Settings 字段，例如
``CB_JWT_SECRET`` -> ``settings.jwt_secret``。

环境变量总览（见 ``.env.example``）：
- CB_JWT_SECRET        必填，JWT 签名密钥，缺失时启动报错
- CB_DEEPSEEK_API_KEY  可选，缺失时使用回退抽取
- CB_CORS_ORIGINS      可选，CSV 形式的 origin 白名单，未设置走默认值
- CB_DATABASE_URL      可选，默认 SQLite，生产化阶段可换 Postgres
"""
import os
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# CORS 默认白名单（与 Render / GH Pages 对齐）。
# 注意：pydantic-settings 2.4 解析 List[str] 字段时若 env 传 CSV
# 会报 JSONDecodeError（"a,b" 不是合法 JSON）。所以 cors_origins
# 不放在 Settings 字段里，而是手动从 os.environ 读。
_DEFAULT_CORS_ORIGINS: List[str] = [
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://localhost:3000",
    "http://localhost:8080",
    "https://cyclebubble-api.onrender.com",
    "https://qiandkk.github.io",
]


def _parse_cors_origins() -> List[str]:
    raw = os.environ.get("CB_CORS_ORIGINS")
    if not raw:
        return list(_DEFAULT_CORS_ORIGINS)
    return [o.strip() for o in raw.split(",") if o.strip()]


class Settings(BaseSettings):
    # 数据库（本地用 SQLite，Render 也用 SQLite 临时存储）
    # 未来生产化阶段，只需把本变量改为 postgresql://... 即可，业务代码零改动。
    database_url: str = "sqlite:///./cyclebubble.db"

    # JWT —— 强制通过环境变量注入密钥，无默认值（缺失即报错）
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 168  # 7 天

    # DeepSeek API
    deepseek_api_key: str = os.getenv("DEEPSEEK_API_KEY", "")
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    deepseek_model: str = "deepseek-chat"

    model_config = SettingsConfigDict(env_prefix="CB_")

    @field_validator("jwt_secret")
    @classmethod
    def _ensure_secret_not_empty(cls, v: str) -> str:
        """防止空字符串 / 纯空白绕过检测——Pydantic 默认会把 ``""`` 视为合法值。"""
        if not v or not v.strip():
            raise ValueError("CB_JWT_SECRET 不能为空字符串或纯空白")
        return v


def _settings_factory() -> Settings:
    """构造 Settings；将 CB_JWT_SECRET 缺失错误转换成更友好的 RuntimeError。"""
    try:
        return Settings()
    except Exception as exc:  # noqa: BLE001 - 顶层友好转化
        msg = str(exc)
        if "jwt_secret" in msg or "CB_JWT_SECRET" in msg:
            raise RuntimeError(
                "CB_JWT_SECRET 未设置，拒绝以不安全默认值启动。"
                "请在环境变量中注入强随机密钥"
                "（可用 `openssl rand -hex 32` 生成）。"
            ) from exc
        raise


settings = _settings_factory()
# CORS 单独挂载（pydantic-settings 不支持 CSV-list 字段）
# 用 SimpleNamespace 既不引入 dataclass import 也能挂载任意属性。
from types import SimpleNamespace
_settings_cors = SimpleNamespace(cors_origins=_parse_cors_origins())
# 挂到 settings 上保持向后兼容（main.py 用 settings.cors_origins 访问）
object.__setattr__(settings, "cors_origins", _settings_cors.cors_origins)
