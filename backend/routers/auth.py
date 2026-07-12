from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlmodel import Session, select
from ..database import get_session, real_engine
from ..models import User, UserLoginAttempt
from ..auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter()

# 密码最小长度（与 admin 一致，提升到 8）
USER_PASSWORD_MIN_LENGTH = 8

# 登录失败限制：
# - 同一邮箱 5 次失败 → 锁 15 分钟
# - 同一 IP 20 次失败（跨账号）→ 锁 15 分钟（防扫描）
USER_LOGIN_MAX_FAILS_PER_EMAIL = 5
USER_LOGIN_MAX_FAILS_PER_IP = 20
USER_LOGIN_LOCK_MINUTES = 15


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=USER_PASSWORD_MIN_LENGTH, max_length=128)
    nickname: str = Field(default="", max_length=50)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _check_user_lock(key: str, kind: str, max_fails: int) -> tuple[bool, int]:
    """检查 (email or ip) 是否被锁，返回 (是否锁定, 剩余秒数)。"""
    window_start = datetime.utcnow() - timedelta(minutes=USER_LOGIN_LOCK_MINUTES)
    with Session(real_engine) as session:
        fails = session.exec(
            select(UserLoginAttempt).where(
                UserLoginAttempt.key == key,
                UserLoginAttempt.kind == kind,
                UserLoginAttempt.success == False,  # noqa: E712
                UserLoginAttempt.timestamp >= window_start,
            )
        ).all()
    if len(fails) >= max_fails:
        latest = max(fails, key=lambda x: x.timestamp)
        unlock_at = latest.timestamp + timedelta(minutes=USER_LOGIN_LOCK_MINUTES)
        remaining = int((unlock_at - datetime.utcnow()).total_seconds())
        return True, max(remaining, 1)
    return False, 0


def _record_user_login_attempt(key: str, kind: str, success: bool) -> None:
    """记录一次登录尝试（email 和 ip 都记，方便跨账号限速）。"""
    with Session(real_engine) as session:
        session.add(UserLoginAttempt(
            key=key,
            kind=kind,
            success=success,
            timestamp=datetime.utcnow(),
        ))
        session.commit()


@router.post("/register", response_model=AuthResponse)
def register(req: RegisterRequest, request: Request):
    """注册（强制写入真实库，不受 X-Demo-Mode header 影响）

    安全：注册必须走真实库，否则 demo 模式下的注册请求会把用户写到
    cyclebubble_demo.db，污染演示数据，导致后续 demo 浏览看到"测试用户"
    或其他人留下的真实账号 nickname。
    """
    ip = _client_ip(request)

    with Session(real_engine) as session:
        # 检查邮箱是否已存在
        existing = session.exec(select(User).where(User.email == req.email)).first()
        if existing:
            raise HTTPException(status_code=400, detail="该邮箱已被注册")

        # 密码长度由 Pydantic Field 校验；这里冗余一句方便错误消息本地化
        if len(req.password) < USER_PASSWORD_MIN_LENGTH:
            raise HTTPException(status_code=400, detail=f"密码至少 {USER_PASSWORD_MIN_LENGTH} 位")

        user = User(
            email=req.email,
            password_hash=hash_password(req.password),
            nickname=req.nickname or req.email.split("@")[0],
            created_at=datetime.utcnow(),
            last_active_at=datetime.utcnow()
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        user_payload = {
            "id": user.id,
            "email": user.email,
            "nickname": user.nickname,
        }

    # 注册成功 = 登录成功，清掉失败计数
    _record_user_login_attempt(req.email, "email", True)
    _record_user_login_attempt(ip, "ip", True)

    token = create_access_token(user_payload["id"])
    return {
        "token": token,
        "user": user_payload,
    }


@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest, request: Request):
    """登录（强制从真实库验证，不受 X-Demo-Mode header 影响）

    安全：
    - EmailStr 强制邮箱格式
    - 密码最少 8 位（前端 + 后端双向校验）
    - 同一邮箱 5 次失败锁 15 分钟；同一 IP 20 次失败锁 15 分钟（防扫号）
    - 必须走真实库——demo 库是只读演示数据，不应被登录命中
    """
    email = (req.email or "").strip().lower()
    ip = _client_ip(request)

    # 1) 双重检查锁（邮箱 + IP 任一被锁都拒绝）
    locked, remaining = _check_user_lock(email, "email", USER_LOGIN_MAX_FAILS_PER_EMAIL)
    if locked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"该邮箱尝试次数过多，请 {remaining} 秒后再试",
            headers={"Retry-After": str(remaining)},
        )
    locked_ip, remaining_ip = _check_user_lock(ip, "ip", USER_LOGIN_MAX_FAILS_PER_IP)
    if locked_ip:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"当前 IP 尝试次数过多，请 {remaining_ip} 秒后再试",
            headers={"Retry-After": str(remaining_ip)},
        )

    with Session(real_engine) as session:
        user = session.exec(select(User).where(User.email == email)).first()
        # 用统一消息避免泄露"账号不存在"信息
        credentials_invalid = (not user) or (not verify_password(req.password, user.password_hash))
        if credentials_invalid:
            _record_user_login_attempt(email, "email", False)
            _record_user_login_attempt(ip, "ip", False)
            raise HTTPException(status_code=401, detail="邮箱或密码错误")

        # 登录成功：清掉失败计数（记一笔 success，下一次失败时窗口重新算）
        _record_user_login_attempt(email, "email", True)
        _record_user_login_attempt(ip, "ip", True)

        user.last_active_at = datetime.utcnow()
        session.add(user)
        session.commit()
        user_payload = {
            "id": user.id,
            "email": user.email,
            "nickname": user.nickname,
        }

    token = create_access_token(user.id)
    return {
        "token": token,
        "user": user_payload,
    }


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """获取当前登录用户信息"""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "nickname": current_user.nickname,
        "created_at": current_user.created_at.isoformat(),
        "last_active_at": current_user.last_active_at.isoformat() if current_user.last_active_at else None
    }