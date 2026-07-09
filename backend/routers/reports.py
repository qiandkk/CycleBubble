"""用户举报路由 — 共鸣页 Memory 举报（最小化内容治理）

端点：
- POST /api/reports  — 提交一条举报（同一用户对同一 memory 去重）
- GET  /api/reports/me — 当前用户的举报历史（前端展示「已举报」状态用）

设计取舍（参考 frontend-design 流程的 restraint）：
- 举报数据**写库**而不是发邮件 / webhook —— 不依赖任何外部服务就能审计
- 状态机：open → reviewed / dismissed。原型阶段不实现自动处理，只暴露
  GET /api/reports/admin 供后期接后台 / cron 用
- 不引入内容审核中间件：关键词扫描已经覆盖自杀/自伤等高危（safety.py），
  举报主要处理「骚扰 / 垃圾 / 其他用户违规」类
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
from database import get_session
from models import User, Memory, Report
from auth import get_current_user

router = APIRouter(prefix="/api/reports", tags=["reports"])


class CreateReportRequest(BaseModel):
    memory_id: str
    reason: str  # spam / harassment / self_harm_concern / other
    note: str | None = None


VALID_REASONS = {"spam", "harassment", "self_harm_concern", "other"}


@router.post("")
def create_report(
    req: CreateReportRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """提交一条对某条共鸣 Memory 的举报。

    - 目标 Memory 必须存在
    - reason 必须在白名单内
    - 同一用户对同一 Memory 只保留第一条（去重）
    """
    if req.reason not in VALID_REASONS:
        raise HTTPException(
            status_code=400,
            detail=f"无效的举报原因，可选：{sorted(VALID_REASONS)}",
        )
    if req.note and len(req.note) > 500:
        raise HTTPException(status_code=400, detail="补充说明不能超过 500 字")

    memory = session.get(Memory, req.memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="Memory 不存在")

    existing = session.exec(
        select(Report)
        .where(Report.reporter_id == user.id)
        .where(Report.memory_id == req.memory_id)
    ).first()
    if existing:
        return {"ok": True, "report_id": existing.id, "duplicate": True}

    r = Report(
        reporter_id=user.id,
        memory_id=req.memory_id,
        reason=req.reason,
        note=req.note,
    )
    session.add(r)
    session.commit()
    session.refresh(r)
    return {"ok": True, "report_id": r.id, "duplicate": False}


@router.get("/me")
def list_my_reports(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """当前用户的举报历史（前端用来在共鸣卡上展示「已举报」标记）"""
    rows = session.exec(
        select(Report)
        .where(Report.reporter_id == user.id)
        .order_by(Report.created_at.desc())
        .limit(100)
    ).all()
    return {
        "reports": [
            {
                "id": r.id,
                "memory_id": r.memory_id,
                "reason": r.reason,
                "status": r.status,
                "created_at": r.created_at.isoformat(),
            }
            for r in rows
        ],
        "total": len(rows),
    }
