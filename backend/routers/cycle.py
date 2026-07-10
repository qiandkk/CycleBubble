from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlmodel import Session, select
from ..database import get_session
from ..models import Cycle, User
from ..auth import get_current_user
from ..cycle_engine import compute_cycle_status

router = APIRouter()


def _is_demo_mode(request: Request) -> bool:
    """判断请求是否来自演示模式（前端 X-Demo-Mode: 1 header）"""
    return request.headers.get("X-Demo-Mode", "").strip() == "1"


def _demo_mode_block():
    """演示模式下写入操作的拒绝响应"""
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="演示模式只读，无法保存数据。请登录后使用完整功能。",
    )

class PeriodCreate(BaseModel):
    start_date: date
    end_date: Optional[date] = None
    flow: Optional[str] = None  # 'light' | 'medium' | 'heavy'
    source: str = "manual"

class ManyouImport(BaseModel):
    periods: List[dict]  # [{"start_date": "2025-12-15", "end_date": "2025-12-20"}, ...]

class AppleHealthImport(BaseModel):
    records: List[dict]  # 标准化格式

class CycleStatusResponse(BaseModel):
    phase: str
    phase_name: str
    description: str
    day_in_cycle: Optional[int]
    days_until_next_period: Optional[int]
    next_period_date: Optional[str]
    confidence: str
    cycle_lengths: List[int]
    is_regular: Optional[bool]

@router.post("/periods")
def create_period(
    req: PeriodCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """添加一次经期记录"""
    if _is_demo_mode(request):
        _demo_mode_block()
    cycle = Cycle(
        user_id=current_user.id,
        start_date=req.start_date,
        end_date=req.end_date,
        flow=req.flow,
        source=req.source,
        created_at=datetime.utcnow()
    )
    session.add(cycle)
    session.commit()
    session.refresh(cycle)
    return {
        "id": cycle.id,
        "start_date": cycle.start_date.isoformat(),
        "end_date": cycle.end_date.isoformat() if cycle.end_date else None,
        "flow": cycle.flow,
        "source": cycle.source
    }

@router.post("/import/manyou")
def import_manyou(
    req: ManyouImport,
    request: Request,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """导入美柚格式的经期数据"""
    if _is_demo_mode(request):
        _demo_mode_block()
    imported = []
    for p in req.periods:
        start = p.get("start_date") or p.get("start")
        end = p.get("end_date") or p.get("end")
        if not start:
            continue
        try:
            start_date = date.fromisoformat(start)
            end_date = date.fromisoformat(end) if end else None
        except ValueError:
            continue

        cycle = Cycle(
            user_id=current_user.id,
            start_date=start_date,
            end_date=end_date,
            flow=p.get("flow"),
            source="manyou",
            created_at=datetime.utcnow()
        )
        session.add(cycle)
        imported.append(cycle)

    session.commit()
    return {"imported_count": len(imported)}

@router.post("/import/apple-health")
def import_apple_health(
    req: AppleHealthImport,
    request: Request,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """导入 Apple Health 格式的经期数据"""
    if _is_demo_mode(request):
        _demo_mode_block()
    imported = []
    for r in req.records:
        start = r.get("startDate") or r.get("start_date")
        end = r.get("endDate") or r.get("end_date")
        if not start:
            continue
        try:
            start_date = date.fromisoformat(start[:10])
            end_date = date.fromisoformat(end[:10]) if end else None
        except (ValueError, TypeError):
            continue

        cycle = Cycle(
            user_id=current_user.id,
            start_date=start_date,
            end_date=end_date,
            flow=r.get("flow"),
            source="apple_health",
            created_at=datetime.utcnow()
        )
        session.add(cycle)
        imported.append(cycle)

    session.commit()
    return {"imported_count": len(imported)}

@router.get("/periods")
def list_periods(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """获取所有经期记录"""
    cycles = session.exec(
        select(Cycle).where(Cycle.user_id == current_user.id).order_by(Cycle.start_date.desc())
    ).all()
    return {
        "periods": [
            {
                "id": c.id,
                "start_date": c.start_date.isoformat(),
                "end_date": c.end_date.isoformat() if c.end_date else None,
                "flow": c.flow,
                "source": c.source
            }
            for c in cycles
        ]
    }

@router.get("/status", response_model=CycleStatusResponse)
def get_cycle_status(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """获取当前周期状态"""
    cycles = session.exec(
        select(Cycle).where(Cycle.user_id == current_user.id).order_by(Cycle.start_date)
    ).all()
    return compute_cycle_status(cycles)

class PeriodUpdate(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    flow: Optional[str] = None

@router.patch("/periods/{period_id}")
def update_period(
    period_id: int,
    req: PeriodUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """修正单条经期记录

    - 跨用户隔离：操作别的用户的 period_id 直接 404
    - 仅修改提供的字段
    - end_date 必须 >= start_date（否则 400）
    """
    if _is_demo_mode(request):
        _demo_mode_block()
    cycle = session.get(Cycle, period_id)
    if not cycle or cycle.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="记录不存在")

    if req.start_date is not None:
        cycle.start_date = req.start_date
    if req.end_date is not None:
        if req.end_date < cycle.start_date:
            raise HTTPException(status_code=400, detail="结束日期必须晚于开始日期")
        cycle.end_date = req.end_date
    if req.flow is not None:
        cycle.flow = req.flow

    session.add(cycle)
    session.commit()
    session.refresh(cycle)

    return {
        "id": cycle.id,
        "start_date": cycle.start_date.isoformat(),
        "end_date": cycle.end_date.isoformat() if cycle.end_date else None,
        "flow": cycle.flow,
        "source": cycle.source
    }

@router.delete("/periods/{period_id}")
def delete_period(
    period_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """删除一条经期记录（用户纠错用）

    - 跨用户隔离：操作别的用户的 period_id 直接 404
    """
    if _is_demo_mode(request):
        _demo_mode_block()
    cycle = session.get(Cycle, period_id)
    if not cycle or cycle.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="记录不存在")

    session.delete(cycle)
    session.commit()
    return {"deleted": True, "id": period_id}