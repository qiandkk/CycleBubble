from typing import List, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "CycleBubble API"
    database_url: str = "sqlite:///./cyclebubble.db"
    # 演示库 URL：未设置时从 database_url 自动推导（在路径末尾插入 _demo）
    # 例如 sqlite:///./cyclebubble.db → sqlite:///./cyclebubble_demo.db
    demo_database_url: Optional[str] = None
    # 用户数据敏感（情绪记录、经期、健康），不能使用默认密钥上线
    # 不给默认值 → 必须显式设置 CB_JWT_SECRET；空白字符串会被拒绝
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 168  # 7 days
    # 默认 CORS 白名单：本地开发地址 + 自部署服务器 + GitHub Pages
    # 生产环境可通过 CB_CORS_ORIGINS 覆盖为具体域名（CSV 形式）
    cors_origins: List[str] = [
        "http://localhost:8000",
        "http://localhost:3000",
        "http://localhost:8080",
        "http://localhost:8766",
        "http://127.0.0.1:8000",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:8766",
        # 自部署服务器
        "http://8.160.187.143",
        "https://8.160.187.143",
        # GitHub Pages
        "https://qiandkk.github.io",
        # Render（如果将来回退到 Render）
        "https://cyclebubble-api.onrender.com",
    ]

    @field_validator("jwt_secret")
    @classmethod
    def _validate_jwt_secret(cls, v: str) -> str:
        """拒绝空白 / 已知弱密钥"""
        if not v or not v.strip():
            raise ValueError(
                "CB_JWT_SECRET 不能为空。"
                "请设置一个强随机密钥（例如：python -c \"import secrets; print(secrets.token_urlsafe(48))\"）。"
            )
        weak = {
            "dev-secret-change-me-in-production",
            "secret",
            "changeme",
            "change-me",
            "your-secret-key",
            "default",
        }
        if v.strip().lower() in weak:
            raise ValueError(
                f"CB_JWT_SECRET 不能使用已知弱密钥 '{v}'。"
                "请设置一个强随机密钥。"
            )
        if len(v.strip()) < 16:
            raise ValueError(
                "CB_JWT_SECRET 长度至少 16 个字符。"
                "请使用 python -c \"import secrets; print(secrets.token_urlsafe(48))\" 生成。"
            )
        return v

    class Config:
        env_prefix = "CB_"
        env_file = ".env"


def _build_settings() -> Settings:
    """构造 Settings，缺失/无效时给出友好提示"""
    try:
        return Settings()
    except Exception as e:
        # 在日志中打印后重新抛出，避免直接暴露内部堆栈细节
        msg = str(e)
        if "jwt_secret" in msg.lower() or "JWT_SECRET" in msg:
            raise RuntimeError(
                "\n\n❌ CycleBubble 启动失败：JWT 密钥配置无效。\n"
                "   用户数据敏感（情绪记录、经期、健康），不能使用默认密钥上线。\n"
                "   请在 .env 或环境变量中设置 CB_JWT_SECRET：\n"
                "     CB_JWT_SECRET=<强随机字符串，至少 16 字符>\n"
                "   生成方式：\n"
                "     python -c \"import secrets; print(secrets.token_urlsafe(48))\"\n"
            ) from e
        raise


settings = _build_settings()
