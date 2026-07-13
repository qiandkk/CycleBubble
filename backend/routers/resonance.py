from datetime import datetime
from typing import Optional
from collections import defaultdict
from time import time
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlmodel import Session, select
from ..database import get_session
from ..models import Memory, Response, User, Cycle
from ..auth import get_current_user
from ..pattern_engine import compute_pattern_similarity
from ..cycle_engine import compute_cycle_status

router = APIRouter()


def _is_demo_mode(request: Request) -> bool:
    return request.headers.get("X-Demo-Mode", "").strip() == "1"


def _demo_mode_block():
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="演示模式只读，无法回应。请登录后使用完整功能。",
    )

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


def _compute_match_reason(
    my_memories: list,
    other_memory: Memory,
    my_cycles: list,
    other_cycles: list
) -> Optional[str]:
    """
    AI Duty 3: 生成共鸣匹配理由

    推荐依据：不是兴趣，不是算法，而是身体背景 + Pattern 相似度。
    返回观察性文案，不定义用户。
    """
    # 提取共同主题
    my_themes = set()
    for m in my_memories:
        my_themes.update(parse_json_list(m.themes))

    other_themes = set(parse_json_list(other_memory.themes))
    shared_themes = my_themes & other_themes

    # 提取共同触发因素
    my_triggers = set()
    for m in my_memories:
        my_triggers.update(parse_json_list(m.triggers))
    other_triggers = set(parse_json_list(other_memory.triggers))
    shared_triggers = my_triggers & other_triggers

    # 检查身体阶段一致性
    my_phase = "unknown"
    if my_cycles:
        my_phase = compute_cycle_status(my_cycles).get("phase", "unknown")
    other_phase = "unknown"
    if other_cycles:
        other_phase = compute_cycle_status(other_cycles).get("phase", "unknown")

    phase_match = my_phase != "unknown" and other_phase != "unknown" and my_phase == other_phase

    # 生成匹配理由（优先级：身体阶段 > 共同主题 > 共同触发）
    phase_names = {
        "menstrual": "月经期",
        "follicular": "卵泡期",
        "ovulation": "排卵期",
        "luteal": "黄体期",
    }

    if phase_match and shared_themes:
        phase_name = phase_names.get(my_phase, my_phase)
        theme_str = "、".join(list(shared_themes)[:2])
        return f"也在{phase_name}，也写了关于「{theme_str}」的记录"
    elif phase_match:
        phase_name = phase_names.get(my_phase, my_phase)
        return f"也在{phase_name}，也有类似的感受"
    elif shared_themes:
        theme_str = "、".join(list(shared_themes)[:2])
        return f"也写了关于「{theme_str}」的记录"
    elif shared_triggers:
        trigger_str = "、".join(list(shared_triggers)[:2])
        return f"好像也遇到了「{trigger_str}」"
    else:
        return "也许会有类似的感受"


@router.get("/feed")
def get_resonance_feed(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    limit: int = 20
):
    """获取匿名化的共鸣推荐流

    AI Duty 3: 社区共鸣
    AI 自动判断不同用户是否表达同一种经历。
    推荐依据：不是兴趣，不是算法，而是身体背景 + Pattern 相似度。
    用户无需搜索，系统自动推荐。
    """
    # 获取当前用户的记忆和周期数据
    my_memories = session.exec(
        select(Memory)
        .where(Memory.user_id == current_user.id)
        .order_by(Memory.created_at.desc())
        .limit(100)
    ).all()

    my_cycles = session.exec(
        select(Cycle)
        .where(Cycle.user_id == current_user.id)
        .order_by(Cycle.start_date)
    ).all()

    # 获取公开记忆（排除敏感内容和自己）
    public_memories = session.exec(
        select(Memory)
        .where(
            Memory.is_public == True,
            Memory.is_sensitive == False,
            Memory.user_id != current_user.id,
        )
        .order_by(Memory.created_at.desc())
        .limit(limit * 3)  # 多取一些用于相似度排序
    ).all()

    # 如果当前用户没有记忆，退化为时间排序
    if not my_memories:
        stories = []
        for m in public_memories[:limit]:
            stories.append({
                "id": m.id,
                "anonymous_name": "一位相似经历的人",
                "text_excerpt": m.raw_text[:120] + ("..." if len(m.raw_text) > 120 else ""),
                "themes": parse_json_list(m.themes),
                "mood": m.mood,
                "created_at": m.created_at.isoformat(),
                "response_count": len(m.responses) if hasattr(m, 'responses') and m.responses else 0,
                "match_reason": None,
                "similarity": 0.0
            })
        return {"stories": stories, "total": len(stories)}

    # 为每个公开记忆计算相似度
    scored_stories = []
    for m in public_memories:
        # 获取记忆作者的周期数据
        other_cycles = session.exec(
            select(Cycle)
            .where(Cycle.user_id == m.user_id)
            .order_by(Cycle.start_date)
        ).all()

        # 计算相似度
        similarity = compute_pattern_similarity(
            my_memories, [m], my_cycles, other_cycles
        )

        # 生成匹配理由
        match_reason = _compute_match_reason(my_memories, m, my_cycles, other_cycles)

        scored_stories.append({
            "id": m.id,
            "anonymous_name": "一位相似经历的人",
            "text_excerpt": m.raw_text[:120] + ("..." if len(m.raw_text) > 120 else ""),
            "themes": parse_json_list(m.themes),
            "mood": m.mood,
            "created_at": m.created_at.isoformat(),
            "response_count": len(m.responses) if hasattr(m, 'responses') and m.responses else 0,
            "match_reason": match_reason,
            "similarity": similarity
        })

    # 按相似度排序（不是时间）
    scored_stories.sort(key=lambda s: s["similarity"], reverse=True)

    # 取前 limit 个
    stories = scored_stories[:limit]

    return {
        "stories": stories,
        "total": len(stories)
    }

@router.post("/{memory_id}/respond")
def respond_to_memory(
    memory_id: int,
    req: RespondRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """对一条公开记忆发送回应"""
    if _is_demo_mode(request):
        _demo_mode_block()
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

    # 敏感记忆不允许被回应（spec v2 B.4）
    if memory.is_sensitive:
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
