from collections import Counter
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from ..database import get_session
from ..models import Memory, Response, User, Cycle
from ..auth import get_current_user
from ..bubble_engine import compute_bubble_params

router = APIRouter()

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

@router.get("")
def get_growth(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """获取成长页数据

    返回：
    - timeline: 时间线（按周聚合的记忆数量）
    - discoveries: 发现（基于记忆的统计：主导情绪、常见主题、常见触发、常见恢复方式）
    - impact: 影响统计（陪伴了多少人）
    - total_records: 总记忆数
    """
    memories = session.exec(
        select(Memory)
        .where(Memory.user_id == current_user.id)
        .order_by(Memory.created_at.desc())
    ).all()

    n = len(memories)

    # 相似阶段人数：当前可见的公开记忆总数（共鸣流就是这些）
    public_total = session.exec(
        select(Memory).where(Memory.is_public == True, Memory.user_id != current_user.id)
    ).all()
    similar_phase_count = len(public_total)

    # 如果没有任何记忆，返回空状态标识
    if n == 0:
        return {
            "total_records": 0,
            "empty_state": True,
            "timeline": [],
            "discoveries": [],
            "impact": {
                "accompanied_count": 0,
                "first_recorder_count": 0,
                "similar_phase_count": similar_phase_count
            }
        }

    # 主导情绪
    mood_counter = Counter(m.mood for m in memories if m.mood)
    dominant_mood = mood_counter.most_common(1)[0][0] if mood_counter else None

    # 主题聚合
    theme_counter = Counter()
    trigger_counter = Counter()
    recovery_counter = Counter()
    for m in memories:
        for t in parse_json_list(m.themes):
            theme_counter[t] += 1
        for t in parse_json_list(m.triggers):
            trigger_counter[t] += 1
        for r in parse_json_list(m.recovery):
            recovery_counter[r] += 1

    discoveries = []
    if dominant_mood:
        discoveries.append({
            "type": "mood",
            "title": "最近的主导情绪",
            "content": dominant_mood,
            "evidence_count": mood_counter[dominant_mood]
        })
    if theme_counter:
        top_theme = theme_counter.most_common(1)[0]
        discoveries.append({
            "type": "theme",
            "title": "最常出现的感受主题",
            "content": top_theme[0],
            "evidence_count": top_theme[1]
        })
    if recovery_counter and n >= 3:
        top_recovery = recovery_counter.most_common(1)[0]
        discoveries.append({
            "type": "recovery",
            "title": "你常用什么方式恢复",
            "content": top_recovery[0],
            "evidence_count": top_recovery[1]
        })

    # 时间线（按周聚合）
    timeline_map = {}
    for m in memories:
        week = m.created_at.strftime("%Y-W%V")
        if week not in timeline_map:
            timeline_map[week] = {"week": week, "count": 0, "first_text": m.raw_text[:40]}
        timeline_map[week]["count"] += 1

    timeline = sorted(timeline_map.values(), key=lambda x: x["week"], reverse=True)[:12]

    # 影响统计
    public_count = sum(1 for m in memories if m.is_public)
    my_responses = session.exec(
        select(Response).where(Response.user_id == current_user.id)
    ).all()
    accompanied_count = public_count  # 简化：公开的故事数 ≈ 陪伴到的人数

    return {
        "total_records": n,
        "empty_state": False,
        "timeline": timeline,
        "discoveries": discoveries,
        "impact": {
            "accompanied_count": accompanied_count,
            "response_count": len(my_responses),
            "similar_phase_count": similar_phase_count
        }
    }


@router.get("/bubble-params")
def get_bubble_params(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """获取 Bubble 6 维度 Growth Parameters

    所有视觉变化都来源于真实数据，不做随机动画。
    遵守 Bubble Constitution 规则。
    """
    memories = session.exec(
        select(Memory)
        .where(Memory.user_id == current_user.id)
        .order_by(Memory.created_at.desc())
    ).all()

    cycles = session.exec(
        select(Cycle)
        .where(Cycle.user_id == current_user.id)
        .order_by(Cycle.start_date)
    ).all()

    return compute_bubble_params(memories, cycles)
