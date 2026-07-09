"""共鸣路由 — 社区故事流 + 回应"""
import random
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
from database import get_session
from models import User, Memory, Response as ResponseModel
from auth import get_current_user
from routers.memories import time_label, memory_to_dict

router = APIRouter(tags=["resonance"])


class ResponseRequest(BaseModel):
    response_type: str = "empathy"
    content: str | None = None


ANON_NAMES = ["匿名泡泡", "一个路人", "路过的风", "某个人", "匿名"]
ANON_IDS = list(range(15, 50))


@router.get("/api/resonance/feed")
def get_feed(
    limit: int = 10,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """获取共鸣页故事流——匿名化的公开 Memory"""
    # 先尝试匹配用户主题
    user_memories = session.exec(
        select(Memory).where(Memory.user_id == user.id)
    ).all()
    user_themes = set()
    for m in user_memories:
        for t in (m.themes or []):
            user_themes.add(t)

    # 查公开 Memory（排除自己的）
    public_memories = session.exec(
        select(Memory)
        .where(Memory.is_public == True)
        .where(Memory.user_id != user.id)
        .order_by(Memory.created_at.desc())
        .limit(50)
    ).all()

    # 按主题重叠度排序
    def theme_overlap(m):
        return len(user_themes & set(m.themes or []))

    public_memories.sort(key=theme_overlap, reverse=True)

    # 如果不够，用种子数据填充
    result = []
    for m in public_memories[:limit]:
        anon_id = random.choice(ANON_IDS)
        result.append({
            "id": m.id,
            "anon_name": f"匿名泡泡 {anon_id}",
            "snippet": m.snippet,
            "themes": m.themes or [],
            "time_label": time_label(m.created_at),
        })

    # 没有真实公开故事就不返回任何假数据
    return {"stories": result[:limit]}


@router.post("/api/resonance/{memory_id}/responses")
def create_response(
    memory_id: str,
    req: ResponseRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """回应一条故事

    安全：必须校验目标 Memory 存在且 ``is_public``，避免对私密 Memory 或
    不存在的 ID 写入回应（深度防御，即使 UUID4 不可枚举仍需在应用层兜底）。
    """
    if req.response_type not in ("empathy", "thanks", "hug", "share"):
        raise HTTPException(status_code=400, detail="无效的回应类型")

    memory = session.get(Memory, memory_id)
    if not memory or not memory.is_public:
        raise HTTPException(status_code=404, detail="Memory 不存在或不可回应")

    resp = ResponseModel(
        responder_id=user.id,
        memory_id=memory_id,
        response_type=req.response_type,
        content=req.content if req.response_type == "share" else None,
    )
    session.add(resp)
    session.commit()

    return {"ok": True, "response_id": resp.id}
