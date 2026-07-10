"""真实账号的个人资料、数据导出与账号删除。"""
import html
import json
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import delete, or_
from sqlmodel import Session, select

from ..auth import get_current_user, require_real_user, verify_password
from ..database import get_session
from ..models import Cycle, Memory, Report, Response as MemoryResponse, User
from .memory import parse_json_list


router = APIRouter(dependencies=[Depends(require_real_user)])


class DeleteAccountRequest(BaseModel):
    password: str
    acknowledged: bool


def _format_datetime(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _serialize_memory(memory: Memory) -> dict[str, Any]:
    return {
        "raw_text": memory.raw_text,
        "themes": parse_json_list(memory.themes),
        "triggers": parse_json_list(memory.triggers),
        "recovery": parse_json_list(memory.recovery),
        "emotions": parse_json_list(memory.emotions),
        "mood": memory.mood,
        "is_public": memory.is_public,
        "created_at": _format_datetime(memory.created_at),
    }


def _export_data(current_user: User, session: Session) -> dict[str, Any]:
    memories = session.exec(
        select(Memory).where(Memory.user_id == current_user.id).order_by(Memory.created_at)
    ).all()
    cycles = session.exec(
        select(Cycle).where(Cycle.user_id == current_user.id).order_by(Cycle.start_date)
    ).all()
    responses = session.exec(
        select(MemoryResponse)
        .where(MemoryResponse.user_id == current_user.id)
        .order_by(MemoryResponse.created_at)
    ).all()

    return {
        "profile": {
            "email": current_user.email,
            "nickname": current_user.nickname,
            "created_at": _format_datetime(current_user.created_at),
        },
        "memories": [_serialize_memory(memory) for memory in memories],
        "cycles": [
            {
                "start_date": cycle.start_date.isoformat(),
                "end_date": cycle.end_date.isoformat() if cycle.end_date else None,
                "flow": cycle.flow,
                "source": cycle.source,
                "created_at": _format_datetime(cycle.created_at),
            }
            for cycle in cycles
        ],
        "responses": [
            {
                "type": response.type,
                "content": response.content,
                "created_at": _format_datetime(response.created_at),
            }
            for response in responses
        ],
    }


def _attachment_response(content: bytes, media_type: str, filename: str) -> Response:
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/summary")
def get_profile_summary(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """返回当前真实账号的基本资料与数据计数。"""
    memory_count = len(session.exec(select(Memory.id).where(Memory.user_id == current_user.id)).all())
    cycle_count = len(session.exec(select(Cycle.id).where(Cycle.user_id == current_user.id)).all())
    return {
        "email": current_user.email,
        "nickname": current_user.nickname,
        "created_at": _format_datetime(current_user.created_at),
        "memory_count": memory_count,
        "cycle_count": cycle_count,
    }


@router.get("/export/json")
def export_json(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """导出当前真实账号的完整个人数据包。"""
    content = json.dumps(_export_data(current_user, session), ensure_ascii=False, indent=2).encode("utf-8")
    filename = f"cyclebubble-data-{datetime.utcnow():%Y%m%d-%H%M%S}.json"
    return _attachment_response(content, "application/json; charset=utf-8", filename)


@router.get("/export/html")
def export_html(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """导出可离线打开的个人数据回顾报告。"""
    data = _export_data(current_user, session)
    profile = data["profile"]
    memory_items = "".join(
        f"<article><time>{html.escape(memory['created_at'] or '')}</time>"
        f"<p>{html.escape(memory['raw_text'])}</p>"
        f"<p>心情：{html.escape(memory['mood'] or '未标注')}</p></article>"
        for memory in data["memories"]
    ) or "<p>暂无情绪记录。</p>"
    cycle_items = "".join(
        f"<li>{html.escape(cycle['start_date'])} 至 {html.escape(cycle['end_date'] or '未结束')}"
        f"，流量：{html.escape(cycle['flow'] or '未记录')}</li>"
        for cycle in data["cycles"]
    ) or "<li>暂无经期记录。</li>"
    response_items = "".join(
        f"<li><time>{html.escape(response['created_at'] or '')}</time> "
        f"{html.escape(response['type'])}：{html.escape(response['content'] or '')}</li>"
        for response in data["responses"]
    ) or "<li>暂无回应记录。</li>"
    document = f"""<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>CycleBubble 数据回顾</title>
<style>body{{max-width:760px;margin:40px auto;padding:0 20px;color:#302a32;line-height:1.7;font-family:system-ui,sans-serif}}section{{margin:32px 0}}article{{border-top:1px solid #ddd;padding:16px 0}}time{{color:#766d75;font-size:.9em}}p{{white-space:pre-wrap}}li{{margin:8px 0}}</style>
</head><body><h1>CycleBubble 数据回顾</h1><p>{html.escape(profile['nickname'] or profile['email'])}</p>
<section><h2>情绪记录</h2>{memory_items}</section>
<section><h2>经期记录</h2><ul>{cycle_items}</ul></section>
<section><h2>我的回应</h2><ul>{response_items}</ul></section>
</body></html>"""
    filename = f"cyclebubble-review-{datetime.utcnow():%Y%m%d-%H%M%S}.html"
    return _attachment_response(document.encode("utf-8"), "text/html; charset=utf-8", filename)


@router.delete("/account")
def delete_account(
    req: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """核验密码后，原子删除当前真实账号和所有相关数据。"""
    if not req.acknowledged:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="请确认已了解删除后无法恢复")
    if not verify_password(req.password, current_user.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="密码或确认信息不正确")

    memory_ids = list(session.exec(select(Memory.id).where(Memory.user_id == current_user.id)).all())
    try:
        session.exec(
            delete(MemoryResponse).where(
                or_(
                    MemoryResponse.user_id == current_user.id,
                    MemoryResponse.memory_id.in_(memory_ids),
                )
            )
        )
        session.exec(
            delete(Report).where(
                or_(
                    Report.reporter_user_id == current_user.id,
                    Report.memory_id.in_(memory_ids),
                )
            )
        )
        session.exec(delete(Memory).where(Memory.user_id == current_user.id))
        session.exec(delete(Cycle).where(Cycle.user_id == current_user.id))
        session.delete(current_user)
        session.commit()
    except Exception:
        session.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="删除账号失败，请稍后重试")

    return {"deleted": True}
