from datetime import datetime
from typing import Optional
from collections import defaultdict
from time import time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
from ..database import get_session
from ..models import Memory, Response, User
from ..auth import get_current_user

router = APIRouter()

VALID_RESPONSE_TYPES = {"我也经历过", "谢谢", "抱抱", "继续说", "分享我的经历"}

class RespondRequest(BaseModel):
    type: str
    content: Optional[str] = None

def parse_json_list(s: str, default=None):
    if default is None:
        default = []
    if not s:
        return default
    try:
        import json
        return json.loads(s)
    except Exception:
        return default

# 频控：每用户每小时最多 30 次回应（防骚扰 / 刷屏）
RATE_LIMIT_WINDOW = 3600  # 1 hour
RATE_LIMIT_MAX = 30

# 简化的内存级频控（生产环境应该用 Redis）
_response_log = defaultdict(list)

def _check_rate_limit(user_id: int) -> bool:
    """返回 True 表示通过，False 表示超限"""
    now = time()
    log = _response_log[user_id]
    # 清理窗口外的记录
    log[:] = [t for t in log if now - t < RATE_LIMIT_WINDOW]
    if len(log) >= RATE_LIMIT_MAX:
        return False
    log.append(now)
    return True

@router.get("/feed")
def get_resonance_feed(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    limit: int = 20
):
    """获取匿名化的公开故事流

    返回当前用户可见的公开记忆（按时间倒序，匿名化）
    """
    public_memories = session.exec(
        select(Memory)
        .where(Memory.is_public == True, Memory.user_id != current_user.id)
        .order_by(Memory.created_at.desc())
        .limit(limit)
    ).all()

    return {
        "stories": [
            {
                "id": m.id,
                "anonymous_name": "一位相似经历的人",  # 匿名化
                "text_excerpt": m.raw_text[:120] + ("..." if len(m.raw_text) > 120 else ""),
                "themes": parse_json_list(m.themes),
                "mood": m.mood,
                "created_at": m.created_at.isoformat(),
                "response_count": len(m.responses) if hasattr(m, 'responses') and m.responses else 0
            }
            for m in public_memories
        ],
        "total": len(public_memories)
    }

@router.post("/{memory_id}/respond")
def respond_to_memory(
    memory_id: int,
    req: RespondRequest,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """对一条公开记忆发送回应"""
    # 频控：每用户每小时最多 30 次回应（防骚扰 / 刷屏）
    if not _check_rate_limit(current_user.id):
        raise HTTPException(
            status_code=429,
            detail=f"回应太频繁，请稍后再试（每小时最多 {RATE_LIMIT_MAX} 次）"
        )

    if req.type not in VALID_RESPONSE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"回应类型必须是: {', '.join(VALID_RESPONSE_TYPES)}"
        )

    memory = session.get(Memory, memory_id)
    if not memory:
        raise HTTPException(status_code=404, detail="记忆不存在")

    # 私密记忆不对外暴露，只有公开记忆才允许回应
    # 防止通过 memory_id 枚举绕过私密性
    if not memory.is_public:
        raise HTTPException(status_code=404, detail="记忆不存在")

    if memory.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="不能回应自己的记忆")

    response = Response(
        memory_id=memory_id,
        user_id=current_user.id,
        type=req.type,
        content=req.content,
        created_at=datetime.utcnow()
    )
    session.add(response)
    session.commit()
    session.refresh(response)

    return {
        "id": response.id,
        "type": response.type,
        "content": response.content,
        "created_at": response.created_at.isoformat()
    }
