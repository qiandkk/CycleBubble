from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlmodel import Session, select
from ..database import get_session
from ..models import Memory, User
from ..auth import get_current_user

router = APIRouter()


def _is_demo_mode(request: Request) -> bool:
    return request.headers.get("X-Demo-Mode", "").strip() == "1"


def _demo_mode_block():
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="演示模式只读，无法保存数据。请登录后使用完整功能。",
    )

class MemoryCreate(BaseModel):
    raw_text: str
    is_public: bool = False
    themes: List[str] = []
    triggers: List[str] = []
    recovery: List[str] = []
    emotions: List[dict] = []  # [{"name": "焦虑", "intensity": 3}]
    mood: str = ""

class MemoryResponse(BaseModel):
    id: int
    raw_text: str
    themes: List[str]
    triggers: List[str]
    recovery: List[str]
    emotions: List[dict]
    mood: str
    is_public: bool
    created_at: str

import json
from ..safety import scan_crisis

def parse_json_list(s: str, default=None):
    """安全解析 JSON 列表"""
    if default is None:
        default = []
    if not s:
        return default
    try:
        return json.loads(s)
    except (json.JSONDecodeError, TypeError):
        return default

@router.post("")
def create_memory(
    req: MemoryCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    """创建一条情绪记录"""
    if _is_demo_mode(request):
        _demo_mode_block()
    if not req.raw_text or len(req.raw_text.strip()) == 0:
        raise HTTPException(status_code=400, detail="记录内容不能为空")

    # 简单的关键词抽取（兜底，等以后接 LLM）
    text = req.raw_text.lower()
    themes = req.themes or []
    triggers = req.triggers or []
    recovery = req.recovery or []
    emotions = req.emotions or []
    mood = req.mood

    if not themes:
        # 简单关键词匹配
        keyword_map = {
            "themes": {
                "工作": ["工作", "老板", "同事", "上班", "开会", "项目"],
                "家庭": ["家", "父母", "妈妈", "爸爸", "孩子"],
                "关系": ["朋友", "恋人", "对象", "分手", "吵架"],
                "自我": ["自己", "我", "价值", "意义"],
                "身体": ["累", "疼", "病", "睡"]
            },
            "triggers": {
                "评价": ["说", "评价", "批评", "表扬", "认可"],
                "比较": ["比", "比较", "别人", "不如"],
                "冲突": ["吵架", "冲突", "矛盾"],
                "变化": ["变化", "改变", "突然"],
                "压力": ["压力", "紧张", "焦虑"]
            },
            "recovery": {
                "独处": ["一个人", "独处", "安静"],
                "运动": ["运动", "跑步", "散步", "瑜伽"],
                "倾诉": ["说", "聊", "朋友", "倾诉"],
                "创作": ["写", "画", "创作", "听音乐"],
                "休息": ["睡", "休息", "放松"]
            }
        }

        for theme, words in keyword_map["themes"].items():
            if any(w in text for w in words):
                themes.append(theme)
        for trigger, words in keyword_map["triggers"].items():
            if any(w in text for w in words):
                triggers.append(trigger)
        for rec, words in keyword_map["recovery"].items():
            if any(w in text for w in words):
                recovery.append(rec)

    if not mood:
        # 简单情绪推断
        mood_keywords = {
            "焦虑": ["焦虑", "担心", "紧张", "不安"],
            "难过": ["难过", "伤心", "哭", "失落", "沮丧"],
            "开心": ["开心", "高兴", "快乐", "愉快", "满足"],
            "平静": ["平静", "宁静", "放松", "安心"],
            "愤怒": ["生气", "愤怒", "恼火", "烦"]
        }
        for m, words in mood_keywords.items():
            if any(w in text for w in words):
                mood = m
                break
        if not mood:
            mood = "平静"

    memory = Memory(
        user_id=current_user.id,
        raw_text=req.raw_text,
        themes=json.dumps(themes, ensure_ascii=False),
        triggers=json.dumps(triggers, ensure_ascii=False),
        recovery=json.dumps(recovery, ensure_ascii=False),
        emotions=json.dumps(emotions, ensure_ascii=False),
        mood=mood,
        is_public=req.is_public,
        created_at=datetime.utcnow()
    )
    session.add(memory)
    session.commit()
    session.refresh(memory)

    # 危机信号兜底：永远不阻断保存，只在响应里标记，由前端决定是否展示
    crisis = scan_crisis(memory.raw_text)

    return {
        "id": memory.id,
        "raw_text": memory.raw_text,
        "themes": parse_json_list(memory.themes),
        "triggers": parse_json_list(memory.triggers),
        "recovery": parse_json_list(memory.recovery),
        "emotions": parse_json_list(memory.emotions),
        "mood": memory.mood,
        "is_public": memory.is_public,
        "created_at": memory.created_at.isoformat(),
        "crisis": crisis,
    }

@router.get("")
def list_memories(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
    limit: int = 50,
    offset: int = 0
):
    """获取用户所有记忆"""
    memories = session.exec(
        select(Memory)
        .where(Memory.user_id == current_user.id)
        .order_by(Memory.created_at.desc())
        .offset(offset)
        .limit(limit)
    ).all()

    return {
        "memories": [
            {
                "id": m.id,
                "raw_text": m.raw_text,
                "themes": parse_json_list(m.themes),
                "triggers": parse_json_list(m.triggers),
                "recovery": parse_json_list(m.recovery),
                "emotions": parse_json_list(m.emotions),
                "mood": m.mood,
                "is_public": m.is_public,
                "created_at": m.created_at.isoformat()
            }
            for m in memories
        ],
        "total": len(memories)
    }
