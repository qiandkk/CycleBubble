"""管理员后台路由 /admin/*

设计见 docs/superpowers/specs/2026-07-11-ai-admin-design.md v2 Part C。

约束：
- 独立签名密钥（CB_ADMIN_JWT_SECRET），JWT header kid=admin，payload aud=admin
- token 有效期 4 小时
- 登录失败 5 次锁定 15 分钟（事件表 AdminLoginAttempt 实时计数）
- 所有 admin 操作双写到 logs/admin.log 与 AdminAudit
- 记忆/经期原文：常规后台不暴露；通过举报查看；一次性访问令牌三因素校验
"""
import json
import logging
import os
import uuid
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Request, status
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from ..auth import (
    create_admin_token,
    decode_admin_token,
    verify_password,
)
from ..config import settings
from ..database import real_engine, get_session
from ..models import (
    AdminAudit,
    AdminLoginAttempt,
    AdminMemoryAccessToken,
    AdminSetting,
    Memory,
    Report,
    User,
)
from ..services.admin_settings import (
    KEY_DEEPSEEK_KEY,
    KEY_ENABLE_KEYWORD_FALLBACK,
    KEY_ENABLE_THIRD_PARTY,
    KEY_MINIMAX_KEY,
    KEY_DEFAULT_PROVIDER,
    KEY_DEFAULT_MODEL_MINIMAX,
    KEY_DEFAULT_MODEL_DEEPSEEK,
    get_bool,
    get_setting,
    mask_api_key,
    set_setting,
)


router = APIRouter(prefix="/admin", tags=["admin"])

# 审计日志同时写入文件
AUDIT_LOG_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "logs")
os.makedirs(AUDIT_LOG_DIR, exist_ok=True)
AUDIT_LOG_FILE = os.path.join(AUDIT_LOG_DIR, "admin.log")
_audit_logger = logging.getLogger("admin_audit")
if not _audit_logger.handlers:
    _handler = logging.FileHandler(AUDIT_LOG_FILE, encoding="utf-8")
    _handler.setFormatter(logging.Formatter("%(asctime)s\t%(message)s"))
    _audit_logger.addHandler(_handler)
    _audit_logger.setLevel(logging.INFO)


# ===== 内存级 IP 限速（开发期） =====
_ip_rate_limit = defaultdict(list)
_RATE_LIMIT_WINDOW = 60
_RATE_LIMIT_MAX = 10


def _enforce_ip_rate_limit(ip: str) -> None:
    import time
    now = time.time()
    window = _ip_rate_limit[ip]
    window[:] = [t for t in window if now - t < _RATE_LIMIT_WINDOW]
    if len(window) >= _RATE_LIMIT_MAX:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="请求过于频繁，请稍后再试",
            headers={"Retry-After": str(_RATE_LIMIT_WINDOW)},
        )
    window.append(now)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


# ===== 登录失败锁定（事件表实时计数） =====

def _is_locked(username: str, ip: str) -> tuple[bool, int]:
    """返回 (是否锁定, 剩余锁定秒数)。"""
    window_start = datetime.utcnow() - timedelta(minutes=settings.admin_login_lock_minutes)
    with Session(real_engine) as session:
        fails = session.exec(
            select(AdminLoginAttempt).where(
                AdminLoginAttempt.username == username,
                AdminLoginAttempt.ip == ip,
                AdminLoginAttempt.success == False,  # noqa: E712
                AdminLoginAttempt.timestamp >= window_start,
            )
        ).all()
    if len(fails) >= settings.admin_login_max_fails:
        latest = max(fails, key=lambda x: x.timestamp)
        unlock_at = latest.timestamp + timedelta(minutes=settings.admin_login_lock_minutes)
        remaining = int((unlock_at - datetime.utcnow()).total_seconds())
        return True, max(remaining, 1)
    return False, 0


def _record_login_attempt(username: str, ip: str, success: bool) -> None:
    with Session(real_engine) as session:
        session.add(AdminLoginAttempt(
            username=username,
            ip=ip,
            success=success,
            timestamp=datetime.utcnow(),
        ))
        session.commit()


# ===== 审计写入 =====

def _audit(request: Request, username: str, action: str, target: str, reason: Optional[str] = None) -> None:
    ip = _client_ip(request)
    ua = (request.headers.get("User-Agent") or "")[:256]
    msg = f"{username}\t{action}\t{target}\t{ip}\t{ua}"
    if reason:
        msg += f"\treason={reason[:200]}"
    _audit_logger.info(msg)
    with Session(real_engine) as session:
        session.add(AdminAudit(
            admin_username=username,
            action=action,
            target=target,
            ip=ip,
            ua=ua,
            reason=reason,
            timestamp=datetime.utcnow(),
        ))
        session.commit()


# ===== require_admin 依赖 =====

def require_admin(authorization: Optional[str] = Header(None)) -> str:
    """校验 admin token：kid=admin + aud=admin + 签名 + exp。"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="未登录")
    token = authorization[7:]
    username = decode_admin_token(token)
    if username is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="登录已过期")
    return username


# ===== 请求模型 =====

class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    token: str
    expires_at: str
    username: str


class AISettingsPayload(BaseModel):
    default_provider: str = "minimax"
    minimax_model: str = "minimax-m3"
    deepseek_model: str = "deepseek-v4-flash"
    enable_third_party_ai: bool = True
    enable_keyword_fallback: bool = True
    minimax_api_key: Optional[str] = None
    deepseek_api_key: Optional[str] = None


class AISettingsResponse(BaseModel):
    default_provider: str
    minimax_model: str
    deepseek_model: str
    enable_third_party_ai: bool
    enable_keyword_fallback: bool
    minimax_api_key_masked: str
    deepseek_api_key_masked: str
    has_minimax_key: bool
    has_deepseek_key: bool


class AccessTokenRequest(BaseModel):
    memory_id: int
    reason: str = Field(min_length=10, max_length=500)


class AccessTokenResponse(BaseModel):
    access_token: str
    expires_at: str
    memory_id: int


# ===== 路由 =====

@router.post("/login", response_model=LoginResponse)
def admin_login(req: LoginRequest, request: Request):
    """管理员登录。失败 5 次锁定 15 分钟（事件表实时计数）。"""
    _enforce_ip_rate_limit(_client_ip(request))
    username = (req.username or "").strip()
    password = req.password or ""
    ip = _client_ip(request)

    locked, remaining = _is_locked(username, ip)
    if locked:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"账号已锁定，请 {remaining} 秒后再试",
            headers={"Retry-After": str(remaining)},
        )

    expected_username = settings.admin_username
    expected_password = settings.admin_password
    if not expected_password:
        raise HTTPException(status_code=500, detail="管理员密码未配置")

    if username != expected_username or password != expected_password:
        _record_login_attempt(username, ip, success=False)
        _audit(request, username, "login_fail", "admin_login", reason="wrong_credentials")
        raise HTTPException(status_code=401, detail="账号或密码错误")

    _record_login_attempt(username, ip, success=True)
    token, expires_at = create_admin_token(username)
    _audit(request, username, "login_success", "admin_login")
    return {
        "token": token,
        "expires_at": expires_at.isoformat(),
        "username": username,
    }


@router.get("/stats")
def admin_stats(request: Request, username: str = Depends(require_admin)):
    """聚合统计：用户/记忆/经期/活跃度。"""
    _audit(request, username, "stats", "admin_stats")
    with Session(real_engine) as session:
        user_count = len(session.exec(select(User)).all())
        memory_count = len(session.exec(select(Memory)).all())
        public_memory_count = len(session.exec(select(Memory).where(Memory.is_public == True)).all())
        sensitive_memory_count = len(session.exec(select(Memory).where(Memory.is_sensitive == True)).all())
        cycle_count = len(session.exec(select(__import__('backend.models').models.Cycle)).all())
        report_open = len(session.exec(
            select(Report).where(Report.status == "open")
        ).all())

        cutoff = datetime.utcnow() - timedelta(days=7)
        recent_users = len(session.exec(
            select(User).where(User.last_active_at != None, User.last_active_at >= cutoff)  # noqa: E711
        ).all())

    return {
        "users": {"total": user_count, "active_7d": recent_users},
        "memories": {"total": memory_count, "public": public_memory_count, "sensitive": sensitive_memory_count},
        "cycles": cycle_count,
        "reports": {"open": report_open},
    }


@router.get("/reports")
def admin_reports(
    request: Request,
    status_filter: str = "open",
    page: int = 1,
    page_size: int = 20,
    username: str = Depends(require_admin),
):
    """举报列表（仅 open / dismissed / reviewed）。"""
    _audit(request, username, "reports_list", f"status={status_filter}")
    offset = max(0, (page - 1) * page_size)
    with Session(real_engine) as session:
        rows = session.exec(
            select(Report)
            .where(Report.status == status_filter)
            .order_by(Report.created_at.desc())
            .offset(offset)
            .limit(page_size)
        ).all()
    return {
        "reports": [
            {
                "id": r.id,
                "memory_id": r.memory_id,
                "reporter_user_id": r.reporter_user_id,
                "reason": r.reason,
                "note": r.note,
                "status": r.status,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ],
        "page": page,
        "page_size": page_size,
    }


@router.get("/reports/{report_id}")
def admin_report_detail(
    report_id: int,
    request: Request,
    username: str = Depends(require_admin),
):
    """举报详情：含被举报记忆原文。"""
    _audit(request, username, "report_view", f"report:{report_id}")
    with Session(real_engine) as session:
        rep = session.get(Report, report_id)
        if not rep:
            raise HTTPException(status_code=404, detail="举报不存在")
        memory = session.get(Memory, rep.memory_id)
        reporter = session.get(User, rep.reporter_user_id)
        return {
            "id": rep.id,
            "memory_id": rep.memory_id,
            "reporter_user_id": rep.reporter_user_id,
            "reporter_nickname": reporter.nickname if reporter else None,
            "reason": rep.reason,
            "note": rep.note,
            "status": rep.status,
            "created_at": rep.created_at.isoformat(),
            "memory": {
                "id": memory.id if memory else None,
                "raw_text": memory.raw_text if memory else None,
                "mood": memory.mood if memory else None,
                "is_public": memory.is_public if memory else None,
                "is_sensitive": memory.is_sensitive if memory else None,
                "created_at": memory.created_at.isoformat() if memory else None,
            } if memory else None,
        }


class ReportActionRequest(BaseModel):
    action: str  # dismiss / delete_memory
    note: Optional[str] = None


@router.post("/reports/{report_id}/action")
def admin_report_action(
    report_id: int,
    req: ReportActionRequest,
    request: Request,
    username: str = Depends(require_admin),
):
    """处理举报：dismiss 关闭；delete_memory 删除关联记忆。"""
    if req.action not in ("dismiss", "delete_memory"):
        raise HTTPException(status_code=400, detail="action 必须是 dismiss 或 delete_memory")
    with Session(real_engine) as session:
        rep = session.get(Report, report_id)
        if not rep:
            raise HTTPException(status_code=404, detail="举报不存在")
        memory = session.get(Memory, rep.memory_id)
        if req.action == "delete_memory" and memory:
            from ..models import Response
            session.exec(__import__('sqlalchemy').delete(Response).where(
                __import__('sqlalchemy').or_(
                    Response.user_id == memory.user_id,
                    Response.memory_id == memory.id,
                )
            ))
            session.exec(__import__('sqlalchemy').delete(Report).where(
                __import__('sqlalchemy').or_(
                    Report.reporter_user_id == memory.user_id,
                    Report.memory_id == memory.id,
                )
            ))
            session.delete(memory)
            rep.status = "reviewed"
        else:
            rep.status = "dismissed"
        session.commit()
    _audit(request, username, "report_action", f"report:{report_id}:{req.action}", reason=req.note)
    return {"ok": True, "report_id": report_id, "action": req.action, "new_status": rep.status}


@router.get("/ai/settings", response_model=AISettingsResponse)
def admin_ai_settings_get(
    request: Request,
    username: str = Depends(require_admin),
):
    _audit(request, username, "ai_settings_get", "ai_settings")
    minimax_key = get_setting(KEY_MINIMAX_KEY, "")
    deepseek_key = get_setting(KEY_DEEPSEEK_KEY, "")
    return {
        "default_provider": get_setting(KEY_DEFAULT_PROVIDER, settings.ai_default_provider),
        "minimax_model": get_setting(KEY_DEFAULT_MODEL_MINIMAX, settings.ai_default_model_minimax),
        "deepseek_model": get_setting(KEY_DEFAULT_MODEL_DEEPSEEK, settings.ai_default_model_deepseek),
        "enable_third_party_ai": get_setting(KEY_ENABLE_THIRD_PARTY, "true") == "true",
        "enable_keyword_fallback": get_setting(KEY_ENABLE_KEYWORD_FALLBACK, "true") == "true",
        "minimax_api_key_masked": mask_api_key(minimax_key),
        "deepseek_api_key_masked": mask_api_key(deepseek_key),
        "has_minimax_key": bool(minimax_key),
        "has_deepseek_key": bool(deepseek_key),
    }


@router.put("/ai/settings")
def admin_ai_settings_put(
    req: AISettingsPayload,
    request: Request,
    username: str = Depends(require_admin),
):
    _audit(request, username, "ai_settings_update", "ai_settings")
    set_setting(KEY_DEFAULT_PROVIDER, req.default_provider, updated_by=username)
    set_setting(KEY_DEFAULT_MODEL_MINIMAX, req.minimax_model, updated_by=username)
    set_setting(KEY_DEFAULT_MODEL_DEEPSEEK, req.deepseek_model, updated_by=username)
    set_setting(KEY_ENABLE_THIRD_PARTY, "true" if req.enable_third_party_ai else "false", updated_by=username)
    set_setting(KEY_ENABLE_KEYWORD_FALLBACK, "true" if req.enable_keyword_fallback else "false", updated_by=username)
    if req.minimax_api_key and len(req.minimax_api_key) >= 16:
        set_setting(KEY_MINIMAX_KEY, req.minimax_api_key, updated_by=username)
    if req.deepseek_api_key and len(req.deepseek_api_key) >= 16:
        set_setting(KEY_DEEPSEEK_KEY, req.deepseek_api_key, updated_by=username)
    return {"ok": True}


@router.post("/ai/test")
async def admin_ai_test(
    request: Request,
    username: str = Depends(require_admin),
):
    """测试所有已配置 API Key 的 AI provider 连通性，返回按 provider 分组的结果。

    返回结构（与 admin.js 联动）：
    {
      "ok": <bool, 至少一个 provider 成功>,
      "primary_provider": "<minimax|deepseek>",
      "providers": {
        "minimax": {"ok", "model", "latency_ms", "status_code", "error"},
        "deepseek": {...}
      }
    }
    """
    _audit(request, username, "ai_test", "ai_settings")
    if get_setting(KEY_ENABLE_THIRD_PARTY, "true") != "true":
        return {"ok": False, "error": "third-party AI disabled"}

    import time
    import asyncio
    import httpx

    # 定义各 provider 的测试配置
    providers_cfg = {
        "minimax": {
            "key_setting": KEY_MINIMAX_KEY,
            "model": get_setting(KEY_DEFAULT_MODEL_MINIMAX, settings.ai_default_model_minimax),
            "endpoint": "https://api.minimax.chat/v1/text/chatcompletion_v2",
            "body_fmt": lambda m: {"model": m, "messages": [{"role": "user", "content": "ping"}], "max_tokens": 1},
        },
        "deepseek": {
            "key_setting": KEY_DEEPSEEK_KEY,
            "model": get_setting(KEY_DEFAULT_MODEL_DEEPSEEK, settings.ai_default_model_deepseek),
            "endpoint": "https://api.deepseek.com/v1/chat/completions",
            "body_fmt": lambda m: {"model": m, "messages": [{"role": "user", "content": "ping"}], "max_tokens": 1},
        },
    }

    async def _test_one(pname: str, cfg: dict) -> tuple:
        """测试单个 provider，返回 (pname, result_dict)。"""
        api_key = get_setting(cfg["key_setting"], "")
        if not api_key:
            return pname, {"ok": False, "error": "missing api key", "latency_ms": None}
        model = cfg["model"]
        started = time.time()
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    cfg["endpoint"],
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json=cfg["body_fmt"](model),
                    timeout=settings.ai_request_timeout_seconds,
                )
            latency_ms = int((time.time() - started) * 1000)
            ok = resp.status_code == 200
            return pname, {
                "ok": ok,
                "model": model,
                "latency_ms": latency_ms,
                "status_code": resp.status_code,
                "error": None if ok else resp.text[:200],
            }
        except Exception as e:
            return pname, {
                "ok": False,
                "model": model,
                "latency_ms": int((time.time() - started) * 1000),
                "error": str(e)[:200],
            }

    # 并发测试所有 provider（不等一个完成再测另一个），加速 admin 后台体验
    tasks = [_test_one(pname, cfg) for pname, cfg in providers_cfg.items()]
    pairs = await asyncio.gather(*tasks, return_exceptions=False)

    results = {pname: result for pname, result in pairs}
    any_ok = any(r.get("ok") for r in results.values())
    primary = get_setting(KEY_DEFAULT_PROVIDER, settings.ai_default_provider)

    return {
        "ok": any_ok,
        "primary_provider": primary,
        "providers": results,
    }


@router.get("/audit")
def admin_audit(
    request: Request,
    username: str = Depends(require_admin),
    from_ts: Optional[str] = None,
    to_ts: Optional[str] = None,
    page: int = 1,
    page_size: int = 50,
):
    """审计日志（仅过去 90 天）。"""
    _audit(request, username, "audit_view", f"page={page}")
    cutoff = datetime.utcnow() - timedelta(days=90)
    with Session(real_engine) as session:
        rows = session.exec(
            select(AdminAudit)
            .where(AdminAudit.timestamp >= cutoff)
            .order_by(AdminAudit.timestamp.desc())
            .offset(max(0, (page - 1) * page_size))
            .limit(page_size)
        ).all()
    return {
        "entries": [
            {
                "id": r.id,
                "admin_username": r.admin_username,
                "action": r.action,
                "target": r.target,
                "ip": r.ip,
                "ua": r.ua,
                "reason": r.reason,
                "timestamp": r.timestamp.isoformat(),
            }
            for r in rows
        ],
        "page": page,
        "page_size": page_size,
    }


class DisableUserRequest(BaseModel):
    reason: Optional[str] = None


@router.post("/users/{user_id}/disable")
def admin_disable_user(
    user_id: int,
    req: DisableUserRequest,
    request: Request,
    username: str = Depends(require_admin),
):
    """禁用用户（标记其 memory 全部 is_sensitive=true，避免再次出现在 feed 中）。"""
    _audit(request, username, "user_disable", f"user:{user_id}", reason=req.reason)
    with Session(real_engine) as session:
        user = session.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="用户不存在")
        # 标记所有其 memory 为 sensitive，避免泄露
        from sqlalchemy import update
        session.exec(
            update(Memory)
            .where(Memory.user_id == user_id)
            .values(is_sensitive=True)
        )
        user.nickname = "[已禁用] " + (user.nickname or "")
        session.commit()
    return {"ok": True, "user_id": user_id}


@router.post("/memory-access-tokens", response_model=AccessTokenResponse)
def admin_create_access_token(
    req: AccessTokenRequest,
    request: Request,
    username: str = Depends(require_admin),
):
    """生成一次性访问令牌（绑定 admin_username + memory_id + reason）。"""
    if len(req.reason.strip()) < 10:
        raise HTTPException(status_code=400, detail="理由至少 10 字")
    with Session(real_engine) as session:
        memory = session.get(Memory, req.memory_id)
        if not memory:
            raise HTTPException(status_code=404, detail="记忆不存在")
        token_id = uuid.uuid4().hex
        expires_at = datetime.utcnow() + timedelta(minutes=10)
        session.add(AdminMemoryAccessToken(
            id=token_id,
            admin_username=username,
            memory_id=req.memory_id,
            reason=req.reason.strip(),
            expires_at=expires_at,
        ))
        session.commit()
    _audit(request, username, "access_token_create", f"memory:{req.memory_id}", reason=req.reason)
    return {
        "access_token": token_id,
        "expires_at": expires_at.isoformat(),
        "memory_id": req.memory_id,
    }


@router.get("/memories/{memory_id}")
def admin_view_memory(
    memory_id: int,
    request: Request,
    access_token: str,
    username: str = Depends(require_admin),
):
    """一次性访问记忆原文。

    三因素必须同时满足：
    1. 管理员当前请求带有效 admin JWT
    2. access_token 未过期且未使用
    3. access_token 绑定的 memory_id 与请求路径一致
    """
    with Session(real_engine) as session:
        token_row = session.get(AdminMemoryAccessToken, access_token)
        if not token_row:
            raise HTTPException(status_code=403, detail="访问令牌无效")
        if token_row.used_at is not None:
            raise HTTPException(status_code=410, detail="访问令牌已使用")
        if token_row.expires_at < datetime.utcnow():
            raise HTTPException(status_code=410, detail="访问令牌已过期")
        if token_row.memory_id != memory_id:
            raise HTTPException(status_code=403, detail="访问令牌与目标不匹配")
        memory = session.get(Memory, memory_id)
        if not memory:
            raise HTTPException(status_code=404, detail="记忆不存在")
        token_row.used_at = datetime.utcnow()
        session.commit()
    _audit(request, username, "memory_view", f"memory:{memory_id}", reason=token_row.reason)
    return {
        "id": memory.id,
        "raw_text": memory.raw_text,
        "themes": json.loads(memory.themes or "[]"),
        "triggers": json.loads(memory.triggers or "[]"),
        "recovery": json.loads(memory.recovery or "[]"),
        "emotions": json.loads(memory.emotions or "[]"),
        "mood": memory.mood,
        "is_public": memory.is_public,
        "is_sensitive": memory.is_sensitive,
        "created_at": memory.created_at.isoformat(),
    }