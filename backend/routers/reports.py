"""用户举报路由 — 共鸣页 Memory 举报

端点：
- POST /api/reports  — 提交一条举报（同一用户对同一 memory 去重）
- GET  /api/reports/me — 当前用户的举报历史

演示模式拒绝：举报是真实账号的行为，demo 模式只供浏览，
不允许在 demo 库写入 Report 数据。
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
from typing import List
from datetime import datetime
from ..database import get_session
from ..models import User, Memory, Report
from ..auth import get_current_user, require_real_user

router = APIRouter(
    prefix="/api/reports",
    tags=["reports"],
    # router 级别拒绝 demo 模式：所有举报端点仅供真实账号
    dependencies=[Depends(require_real_user)],
)


class CreateReportRequest(BaseModel):
    memory_id: int
    reason: str  # spam / harassment / self_harm_concern / other
    note: str = ""


VALID_REASONS = {"spam", "harassment", "self_harm_concern", "other"}


@router.post("")
def create_report(
    req: CreateReportRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """提交一条对某条共鸣 Memory 的举报。"""
    if req.reason not in VALID_REASONS:
        raise HTTPException(
            status_code=400,
            detail=f"无效的举报原因，可选：{sorted(VALID_REASONS)}"
        )
    if req.note and len(req.note) > 500:
        raise HTTPException(status_code=400, detail="备注不能超过 500 字")

    # 检查 memory 是否存在
    memory = session.get(Memory, req.memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="目标记忆不存在")

    # 去重：同 user+memory 只保留第一条
    existing = session.exec(
        select(Report).where(
            Report.memory_id == req.memory_id,
            Report.reporter_user_id == user.id
        )
    ).first()
    if existing:
        return {
            "id": existing.id,
            "memory_id": existing.memory_id,
            "reason": existing.reason,
            "status": "已举报",
            "created_at": existing.created_at.isoformat()
        }

    report = Report(
        memory_id=req.memory_id,
        reporter_user_id=user.id,
        reason=req.reason,
        note=req.note or None,
        status="open",
        created_at=datetime.utcnow()
    )
    session.add(report)
    session.commit()
    session.refresh(report)

    return {
        "id": report.id,
        "memory_id": report.memory_id,
        "reason": report.reason,
        "note": report.note,
        "status": "open",
        "created_at": report.created_at.isoformat()
    }


@router.get("/me")
def list_my_reports(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """当前用户的举报历史"""
    reports = session.exec(
        select(Report)
        .where(Report.reporter_user_id == user.id)
        .order_by(Report.created_at.desc())
    ).all()

    return {
        "reports": [
            {
                "id": r.id,
                "memory_id": r.memory_id,
                "reason": r.reason,
                "note": r.note,
                "status": r.status,
                "created_at": r.created_at.isoformat()
            }
            for r in reports
        ],
        "total": len(reports)
    }