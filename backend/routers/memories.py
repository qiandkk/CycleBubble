"""记忆路由 — 写入(含 AI 抽取) / 读取 / Pattern / Bubble 状态"""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select
from database import get_session
from models import User, Memory, Response as ResponseModel, Cycle
from auth import get_current_user
from ai_agent import extract_memory
from patterns import compute_patterns, compute_bubble_state
from cycle_engine import compute_cycle_status, to_naive_utc
from safety import scan as scan_crisis

router = APIRouter(tags=["memories"])


def make_snippet(text: str) -> str:
    if len(text) > 50:
        return text[:50] + "..."
    return text


def time_label(created_at: datetime) -> str:
    """生成展示用时间标签"""
    now = datetime.utcnow()
    # SQLite 返回 naive datetime，确保比较时也是 naive
    if created_at.tzinfo is not None:
        created_at = created_at.replace(tzinfo=None)
    diff = now - created_at
    if diff < timedelta(hours=1):
        return "刚刚"
    elif diff < timedelta(days=1):
        return "今天"
    elif diff < timedelta(days=3):
        return "三天前"
    elif diff < timedelta(days=7):
        return "一周前"
    elif diff < timedelta(days=30):
        return "一个月前"
    else:
        return "更早"


def memory_to_dict(m: Memory) -> dict:
    """Memory 对象转前端兼容的 dict"""
    return {
        "id": m.id,
        "snippet": m.snippet,
        "rawText": m.raw_text,
        "timeLabel": time_label(m.created_at),
        "themes": m.themes or [],
        "triggers": m.triggers or [],
        "recovery": m.recovery or [],
        "emotions": m.emotions or [],
        "mood": m.mood or "未明",
        "expressionStyle": m.expression_style or "倾诉",
        "hasAction": m.has_action,
        "event": m.event,
        "createdAt": m.created_at.isoformat(),
    }


class CreateMemoryRequest(BaseModel):
    raw_text: str
    is_public: bool = False


class InsightResponse(BaseModel):
    evidence: str  # 用户原话
    pattern_observation: str  # 基于真实 Pattern 的观察
    reflection: str  # 留白


@router.post("/api/memories")
async def create_memory(
    req: CreateMemoryRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """写入 Memory + AI 抽取 + 生成理解页数据"""
    text = req.raw_text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="内容不能为空")

    # 1. AI 抽取
    extracted = await extract_memory(text)

    # 2. 落库
    memory = Memory(
        user_id=user.id,
        raw_text=text,
        snippet=make_snippet(text),
        themes=extracted.get("themes", []),
        event=extracted.get("event"),
        objects=extracted.get("objects", []),
        triggers=extracted.get("triggers", []),
        recovery=extracted.get("recovery", []),
        emotions=extracted.get("emotions", []),
        expression_style=extracted.get("expression_style"),
        has_action=extracted.get("has_action", False),
        mood=extracted.get("mood", "未明"),
        is_public=req.is_public,
        llm_raw=extracted.get("llm_raw"),
    )
    session.add(memory)
    session.commit()
    session.refresh(memory)

    # 3. 生成理解页数据（Evidence → Pattern → Reflection）
    all_memories = session.exec(
        select(Memory).where(Memory.user_id == user.id).order_by(Memory.created_at)
    ).all()

    patterns = compute_patterns(all_memories)

    # Pattern 观察：只引用真实计数
    observation = "Bubble 把它收下了。"
    theme_items = sorted(patterns["themes"].items(), key=lambda x: x[1], reverse=True)
    if patterns["total_memories"] <= 1:
        observation = "这是你留给 Bubble 的第一段话。"
    elif theme_items and theme_items[0][1] >= 2:
        observation = f"这些记录里，「{theme_items[0][0]}」反复出现了 {theme_items[0][1]} 次。"

    insight = {
        "evidence": text,
        "pattern_observation": observation,
        "reflection": "你自己觉得呢？",
    }

    return {
        "memory": memory_to_dict(memory),
        "insight": insight,
        # 危机信号检测（兜底，永远不阻断保存）
        "crisis": scan_crisis(text),
    }


@router.get("/api/memories")
def list_memories(
    limit: int = Query(50, le=200),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """获取当前用户的 Memory 列表"""
    memories = session.exec(
        select(Memory)
        .where(Memory.user_id == user.id)
        .order_by(Memory.created_at.desc())
        .limit(limit)
    ).all()

    return {
        "memories": [memory_to_dict(m) for m in reversed(memories)],  # 时间正序
        "total": len(memories),
    }


@router.get("/api/patterns")
def get_patterns(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """获取 Pattern 聚合数据"""
    memories = session.exec(
        select(Memory).where(Memory.user_id == user.id).order_by(Memory.created_at)
    ).all()

    return compute_patterns(memories)


@router.get("/api/bubble-state")
def get_bubble_state(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """获取 Bubble 视觉状态（含当前周期阶段信息）"""
    memories = session.exec(
        select(Memory).where(Memory.user_id == user.id).order_by(Memory.created_at)
    ).all()

    patterns = compute_patterns(memories)
    bubble = compute_bubble_state(patterns)

    # 附带当前周期阶段（无数据时 phase=None，不假设任何阶段）
    cycles = session.exec(
        select(Cycle)
        .where(Cycle.user_id == user.id)
        .order_by(Cycle.period_start.asc())
    ).all()
    period_starts = [to_naive_utc(c.period_start) for c in cycles]
    bubble["cycle"] = compute_cycle_status(period_starts)

    return bubble


@router.get("/api/growth")
def get_growth(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """成长页数据：时间线 + 观察故事 + 影响统计"""
    memories = session.exec(
        select(Memory).where(Memory.user_id == user.id).order_by(Memory.created_at)
    ).all()

    patterns = compute_patterns(memories)

    # 时间线：只返回最早和最近
    timeline = {"earliest": None, "latest": None, "hidden_count": 0}
    if len(memories) > 0:
        timeline["latest"] = memory_to_dict(memories[-1])
        if len(memories) > 2:
            timeline["earliest"] = memory_to_dict(memories[0])
            timeline["hidden_count"] = len(memories) - 2
        elif len(memories) == 2:
            timeline["earliest"] = memory_to_dict(memories[0])

    # 成长故事（需要 >= 2 条不同内容的记忆）
    stories = _generate_stories(memories, patterns)

    # 影响统计 —— 统计"我的 Memory 被多少人回应"，而不是"我回应了多少人"
    # 修复前 responder_id==user.id 方向反了，把回应者数量记成了作者陪伴别人数
    my_memory_ids = select(Memory.id).where(Memory.user_id == user.id)
    response_count = session.exec(
        select(ResponseModel).where(ResponseModel.memory_id.in_(my_memory_ids))
    ).all()
    impact = {"accompanied_count": len(response_count)}  # 只统计真实回应

    # 旁白
    richness = patterns["theme_count"] + patterns["recovery_count"]
    if patterns["total_memories"] == 0:
        narration = "Bubble 还在等你"
        headline = "Bubble 还在等你写下第一句话"
    elif richness >= 5 and len(response_count) >= 2:
        narration = "Bubble 好像越来越懂你了"
        headline = "Bubble 想和你分享一些最近才发现的变化"
    elif richness >= 3:
        narration = "Bubble 开始记住你的节奏了"
        headline = "Bubble 发现了一些也许值得看看的变化"
    else:
        narration = "Bubble 还在慢慢认识你"
        headline = "Bubble 正在慢慢认识你"

    return {
        "timeline": timeline,
        "stories": stories,
        "impact": impact,
        "narration": narration,
        "headline": headline,
    }


def _generate_stories(memories: list, patterns: dict) -> list:
    """生成成长故事（只展示原话，不让 AI 宣布变化）"""
    stories = []

    if patterns["total_memories"] < 2:
        return stories

    # 表达方式：不同时期的原话对比
    self_memories = [m for m in memories if "自我" in (m.themes or [])]
    express_memories = [m for m in memories if "表达" in (m.themes or [])]
    all_express = self_memories + express_memories

    # 去重
    seen_ids = set()
    deduped = []
    for m in all_express:
        if m.id not in seen_ids:
            seen_ids.add(m.id)
            deduped.append(m)
    all_express = deduped

    if len(all_express) >= 2:
        first, last = all_express[0], all_express[-1]
        if first.snippet != last.snippet:
            stories.append({
                "tag": "表达方式",
                "text": "这两段话，是不同时期留下的。",
                "quotes": [
                    {"time": time_label(first.created_at), "text": first.snippet},
                    {"time": time_label(last.created_at), "text": last.snippet},
                ],
            })

    # 恢复方式
    recovery_memories = [m for m in memories if m.recovery]
    seen_ids = set()
    deduped = []
    for m in recovery_memories:
        if m.id not in seen_ids:
            seen_ids.add(m.id)
            deduped.append(m)
    recovery_memories = deduped

    if len(recovery_memories) >= 2:
        first, last = recovery_memories[0], recovery_memories[-1]
        if first.snippet != last.snippet:
            stories.append({
                "tag": "恢复方式",
                "text": "这些记录里，都提到了让自己好起来的方式。",
                "quotes": [
                    {"time": time_label(first.created_at), "text": first.snippet},
                    {"time": time_label(last.created_at), "text": last.snippet},
                ],
            })

    return stories
