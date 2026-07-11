from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select
from .config import settings
from .database import get_session
from .models import User

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    """哈希密码"""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """验证密码"""
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: int) -> str:
    """生成 JWT token"""
    expire = datetime.utcnow() + timedelta(hours=settings.jwt_expire_hours)
    payload = {"sub": str(user_id), "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> Optional[int]:
    """解码 JWT，返回 user_id 或 None"""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        user_id = int(payload.get("sub"))
        return user_id
    except (JWTError, ValueError, TypeError):
        return None


def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    session: Session = Depends(get_session),
) -> User:
    """FastAPI 依赖：获取当前登录用户

    演示模式（X-Demo-Mode: 1 header）：
      - 跳过 token 校验（演示用）
      - 自动返回 demo 账号（demo 库里预置，邮箱 demo@cyclebubble.local）
      - session 自动是 demo 库（get_session 依赖已按 header 切换）
    真实模式：
      - 校验 Bearer token，从 session 取 User
    """
    is_demo = request.headers.get("X-Demo-Mode", "").strip() == "1"

    if is_demo:
        demo_email = "demo@cyclebubble.local"
        user = session.exec(select(User).where(User.email == demo_email)).first()
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="演示数据未初始化，请运行 python -m backend.seed_demo",
            )
        return user

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未登录或登录已过期",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    user_id = decode_token(token)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未登录或登录已过期"
        )
    user = session.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在"
        )
    # 更新最后活跃时间
    user.last_active_at = datetime.utcnow()
    session.add(user)
    session.commit()
    return user


def require_real_user(request: Request) -> None:
    """拒绝演示模式访问仅面向真实账号的数据操作。"""
    if request.headers.get("X-Demo-Mode", "").strip() == "1":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="演示模式仅供浏览，请登录后使用此功能。",
        )


# ========== 管理员 JWT（独立签名密钥 + kid + aud） ==========

def create_admin_token(username: str) -> tuple[str, datetime]:
    """生成管理员 token。

    返回 (token, expires_at)。
    JWT header: kid="admin" 标识签名密钥
    JWT payload: aud="admin", sub=username, exp, iat
    """
    expire = datetime.utcnow() + timedelta(hours=settings.admin_jwt_expire_hours)
    payload = {
        "aud": "admin",
        "sub": username,
        "exp": expire,
        "iat": datetime.utcnow(),
    }
    token = jwt.encode(
        payload,
        settings.admin_jwt_secret,
        algorithm=settings.jwt_algorithm,
        headers={"kid": "admin"},
    )
    return token, expire


def decode_admin_token(token: str) -> Optional[str]:
    """校验 admin token：kid 必须为 admin，aud 必须为 admin。"""
    try:
        # python-jose 不会主动校验 kid，但会通过签名选择密钥。
        # 我们单独 verify 签名前先解码 header。
        unverified_header = jwt.get_unverified_header(token)
        if unverified_header.get("kid") != "admin":
            return None
        payload = jwt.decode(
            token,
            settings.admin_jwt_secret,
            algorithms=[settings.jwt_algorithm],
            audience="admin",
        )
        return payload.get("sub")
    except (JWTError, ValueError, TypeError, KeyError):
        return None
