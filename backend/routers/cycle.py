"""经期周期路由 — 添加经期 / 获取状态 / 获取记录 / 手动修正

端点：
- POST   /api/cycle/periods           — 添加一次经期开始日期（可选结束日期）
- GET    /api/cycle/periods           — 获取所有经期记录（按开始日期正序）
- PATCH  /api/cycle/periods/{id}      — 手动修正经期日期（解决算法误判）
- DELETE /api/cycle/periods/{id}      — 删除一条错误的经期记录
- GET    /api/cycle/status            — 获取当前周期阶段 + 置信度

datetime 统一使用 naive UTC（与 models.py 一致）。
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
from database import get_session
from models import User, Cycle
from auth import get_current_user
from cycle_engine import compute_cycle_status, to_naive_utc

router = APIRouter(prefix="/api/cycle", tags=["cycle"])


class AddPeriodRequest(BaseModel):
    period_start: datetime
    period_end: datetime | None = None


class UpdatePeriodRequest(BaseModel):
    period_start: datetime | None = None
    period_end: datetime | None = None


def cycle_to_dict(c: Cycle) -> dict:
    return {
        "id": c.id,
        "period_start": c.period_start.isoformat(),
        "period_end": c.period_end.isoformat() if c.period_end else None,
        "cycle_length": c.cycle_length,
        "created_at": c.created_at.isoformat(),
    }


def _recompute_adjacent_cycle_lengths(
    session: Session, user_id: str, anchor_id: str, anchor_start: datetime,
    anchor_deleted: bool = False,
) -> None:
    """重新计算 anchor 这条记录附近两条邻居的 cycle_length。

    PATCH 之后，anchor 的位置变了，左右两邻居的间隔都要重算。
    DELETE 之后，anchor 已经从 session 移除（anchor_deleted=True），
    此时只重算「prev → nxt」的间隔。
    """
    # 1) 找 anchor 之前最近的一条
    prev = session.exec(
        select(Cycle)
        .where(Cycle.user_id == user_id)
        .where(Cycle.id != anchor_id)
        .where(Cycle.period_start < anchor_start)
        .order_by(Cycle.period_start.desc())
    ).first()
    # 2) 找 anchor 之后最近的一条
    nxt = session.exec(
        select(Cycle)
        .where(Cycle.user_id == user_id)
        .where(Cycle.id != anchor_id)
        .where(Cycle.period_start > anchor_start)
        .order_by(Cycle.period_start.asc())
    ).first()

    if anchor_deleted:
        # 删除路径：只重算 prev -> nxt，cycle_length 归 prev
        if prev is not None:
            prev.cycle_length = None
        if nxt is not None:
            nxt.cycle_length = None
        if prev is not None and nxt is not None:
            prev.cycle_length = (to_naive_utc(nxt.period_start) - to_naive_utc(prev.period_start)).days
        if prev is not None:
            session.add(prev)
        if nxt is not None:
            session.add(nxt)
        return

    # PATCH 路径：清空三者，再按新位置重算
    if prev is not None:
        prev.cycle_length = None
    anchor = session.get(Cycle, anchor_id)
    if anchor is not None:
        anchor.cycle_length = None
    if nxt is not None:
        nxt.cycle_length = None

    if prev is not None and anchor is not None:
        prev.cycle_length = (anchor_start - to_naive_utc(prev.period_start)).days
    if anchor is not None and nxt is not None:
        anchor.cycle_length = (to_naive_utc(nxt.period_start) - anchor_start).days

    session.add(prev) if prev else None
    session.add(anchor) if anchor else None
    session.add(nxt) if nxt else None


@router.post("/periods")
def add_period(
    req: AddPeriodRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    start = to_naive_utc(req.period_start)
    end = to_naive_utc(req.period_end) if req.period_end else None

    if end is not None and end < start:
        raise HTTPException(status_code=400, detail="经期结束日期不能早于开始日期")

    # 同一天去重
    existing = session.exec(
        select(Cycle).where(Cycle.user_id == user.id)
    ).all()
    for e in existing:
        if to_naive_utc(e.period_start).date() == start.date():
            raise HTTPException(status_code=400, detail="该日期已有经期记录")

    cycle = Cycle(user_id=user.id, period_start=start, period_end=end)
    session.add(cycle)
    session.flush()

    # 回填 cycle_length
    prev = session.exec(
        select(Cycle)
        .where(Cycle.user_id == user.id).where(Cycle.id != cycle.id)
        .where(Cycle.period_start < start)
        .order_by(Cycle.period_start.desc())
    ).first()
    if prev is not None:
        prev.cycle_length = (start - to_naive_utc(prev.period_start)).days
        session.add(prev)
    nxt = session.exec(
        select(Cycle)
        .where(Cycle.user_id == user.id).where(Cycle.id != cycle.id)
        .where(Cycle.period_start > start)
        .order_by(Cycle.period_start.asc())
    ).first()
    if nxt is not None:
        cycle.cycle_length = (to_naive_utc(nxt.period_start) - start).days

    session.commit()
    session.refresh(cycle)
    return {"cycle": cycle_to_dict(cycle)}


@router.patch("/periods/{period_id}")
def update_period(
    period_id: str,
    req: UpdatePeriodRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """手动修正一条经期记录的开始 / 结束日期。

    用途：算法误判时用户可以纠偏。修正后会重算受影响邻居的 cycle_length。
    """
    cycle = session.get(Cycle, period_id)
    if not cycle or cycle.user_id != user.id:
        raise HTTPException(status_code=404, detail="该经期记录不存在或不可修改")

    new_start = to_naive_utc(req.period_start) if req.period_start else to_naive_utc(cycle.period_start)
    new_end   = to_naive_utc(req.period_end)   if req.period_end   is not None else (
        to_naive_utc(cycle.period_end) if cycle.period_end else None
    )
    if new_end is not None and new_end < new_start:
        raise HTTPException(status_code=400, detail="经期结束日期不能早于开始日期")

    # 防重复（同日期已存在另一条）
    for other in session.exec(
        select(Cycle).where(Cycle.user_id == user.id).where(Cycle.id != period_id)
    ).all():
        if to_naive_utc(other.period_start).date() == new_start.date():
            raise HTTPException(status_code=400, detail="该日期已有经期记录")

    cycle.period_start = new_start
    cycle.period_end   = new_end
    session.add(cycle)

    _recompute_adjacent_cycle_lengths(session, user.id, period_id, new_start)

    session.commit()
    session.refresh(cycle)
    return {"cycle": cycle_to_dict(cycle)}


@router.delete("/periods/{period_id}")
def delete_period(
    period_id: str,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """删除一条错误的经期记录。删除后重算邻居的 cycle_length。"""
    cycle = session.get(Cycle, period_id)
    if not cycle or cycle.user_id != user.id:
        raise HTTPException(status_code=404, detail="该经期记录不存在或不可删除")

    anchor_start = to_naive_utc(cycle.period_start)
    session.delete(cycle)
    session.flush()  # 让删除真正提交

    _recompute_adjacent_cycle_lengths(
        session, user.id, period_id, anchor_start, anchor_deleted=True
    )

    session.commit()
    return {"ok": True, "deleted_id": period_id}


@router.get("/periods")
def list_periods(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    cycles = session.exec(
        select(Cycle).where(Cycle.user_id == user.id)
        .order_by(Cycle.period_start.asc())
    ).all()
    return {
        "periods": [cycle_to_dict(c) for c in cycles],
        "total": len(cycles),
    }


@router.get("/status")
def get_status(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    cycles = session.exec(
        select(Cycle).where(Cycle.user_id == user.id)
        .order_by(Cycle.period_start.asc())
    ).all()
    period_starts = [to_naive_utc(c.period_start) for c in cycles]
    return compute_cycle_status(period_starts)

