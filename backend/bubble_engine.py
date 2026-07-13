"""
Bubble Constitution + Growth System
====================================

Bubble 不是情绪分数、不是宠物、不是等级系统、不是 AI 助手。
Bubble 是用户长期记录过程中，逐渐形成的一个"理解自己的生命体"。

所有视觉变化都必须表达：理解深度（Understanding）
而不是：情绪强弱（Emotion）或 成长等级（Level）

六维度生命周期：
  ① 液体高度 (Memory)     — 最近30天记录活跃程度
  ② 液体颜色 (Body)       — 身体阶段（绝不表示情绪）
  ③ 饱和度 (Emotion Temp) — 情绪温度（降低饱和度，绝不换颜色）
  ④ 液体运动 (Rhythm)     — 生活节奏稳定性
  ⑤ 内部纹理 (Pattern)    — 长期 Pattern 积累
  ⑥ 透明度 (Understanding) — 理解深度

成长规则：Event → Memory → Pattern → Bubble change
  一次记录最多影响 Memory，不能直接改变 Pattern。
  Pattern 至少需要一个完整周期或连续多个相似事件才能形成。
"""

import json
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional
from .models import Memory, Cycle
from .cycle_engine import compute_cycle_status
from .pattern_engine import detect_patterns, generate_pattern_narration


# ============================================================
# 身体阶段颜色映射（液体颜色 = Body，绝不表示情绪）
# ============================================================
PHASE_COLORS = {
    "menstrual": {
        "hue": 345,       # 深酒红
        "saturation": 0.45,
        "lightness": 38,
        "description": "身体正在修复"
    },
    "follicular": {
        "hue": 165,       # 青绿色
        "saturation": 0.40,
        "lightness": 52,
        "description": "逐渐恢复"
    },
    "ovulation": {
        "hue": 42,        # 暖金色
        "saturation": 0.50,
        "lightness": 58,
        "description": "生命力旺盛"
    },
    "luteal": {
        "hue": 28,        # 暖橙琥珀
        "saturation": 0.42,
        "lightness": 48,
        "description": "能量缓缓下沉"
    },
    "unknown": {
        "hue": 275,       # 柔紫（中性）
        "saturation": 0.20,
        "lightness": 55,
        "description": "等待了解你的节奏"
    }
}


# ============================================================
# Bubble Constitution 规则（文案约束）
# ============================================================
CONSTITUTION_RULES = {
    "never_define": [
        "你是焦虑型", "你就是容易内耗的人", "你是一个敏感的人",
        "你属于", "你的性格是", "你的人格类型"
    ],
    "never_evaluate": [
        "好情绪", "坏情绪", "积极", "消极", "正面", "负面",
        "你应该", "你需要", "建议你", "你最好"
    ],
    "body_first": True,  # 先解释身体背景，后解释事件
    "accept_exception": True,  # 允许"今天只是今天"
}


def _parse_json_list(s: str, default=None):
    if default is None:
        default = []
    if not s:
        return default
    try:
        return json.loads(s)
    except Exception:
        return default


def _parse_emotions(s: str) -> list:
    """解析 emotions JSON 字段，返回 [{name, intensity}] 列表"""
    items = _parse_json_list(s, [])
    result = []
    for item in items:
        if isinstance(item, dict) and "name" in item:
            result.append({
                "name": item["name"],
                "intensity": item.get("intensity", 3)
            })
    return result


# ============================================================
# 核心计算：6 维度 Growth Parameters
# ============================================================

def compute_bubble_params(
    memories: List[Memory],
    cycles: List[Cycle],
    today: Optional[date] = None
) -> Dict[str, Any]:
    """
    计算 Bubble 的 6 个维度参数。
    所有参数都来源于真实数据，不做随机动画。

    返回:
    {
        "liquid_height": float,       # ① 液体高度 (30-85%)
        "liquid_color": {             # ② 液体颜色（身体阶段）
            "hue": int, "saturation": float, "lightness": int,
            "phase": str, "description": str
        },
        "saturation": float,          # ③ 饱和度 (0.3-1.0)，情绪温度
        "rhythm": {                   # ④ 液体运动
            "speed": float,           # 动画速度倍率 (0.5-1.5)
            "stability": float,       # 稳定性 (0-1)
            "turbulence": float       # 震动幅度 (0-1)
        },
        "texture": {                  # ⑤ 内部纹理
            "layers": int,            # 纹理层数 (0-7)
            "complexity": float,      # 复杂度 (0-1)
            "has_pattern": bool       # 是否已形成 Pattern
        },
        "transparency": float,        # ⑥ 透明度 (0.3-0.95)，理解深度
        "narration": str,             # 成长旁白（遵守 Constitution）
        "constitution": dict          # Constitution 规则（供前端使用）
    }
    """
    if today is None:
        today = date.today()

    n = len(memories)

    # -- ① 液体高度 (Memory) --
    # 最近30天记录活跃程度，不是累计数量
    # 连续记录 → 缓慢上升；停止记录 → 每天下降0.5%，最低30%，永不归零
    thirty_days_ago = datetime.combine(today - timedelta(days=30), datetime.min.time())
    recent_memories = [m for m in memories if m.created_at >= thirty_days_ago]
    recent_count = len(recent_memories)

    # 基础高度：30% 起步，每条近期记录 +2%，上限 85%
    liquid_height = min(85.0, 30.0 + recent_count * 2.0)

    # 如果有记录但最近7天没新记录，缓慢下降
    if n > 0:
        seven_days_ago = datetime.combine(today - timedelta(days=7), datetime.min.time())
        very_recent = [m for m in memories if m.created_at >= seven_days_ago]
        if len(very_recent) == 0:
            # 找到最后一条记录的日期
            last_memory = max(memories, key=lambda m: m.created_at)
            days_since = (datetime.combine(today, datetime.min.time()) - last_memory.created_at).days
            # 每天下降0.5%，最低30%
            liquid_height = max(30.0, liquid_height - days_since * 0.5)

    # -- ② 液体颜色 (Body) --
    # 颜色只表示身体阶段，绝不表示情绪
    cycle_status = compute_cycle_status(cycles, today)
    phase = cycle_status.get("phase", "unknown")
    phase_color = PHASE_COLORS.get(phase, PHASE_COLORS["unknown"])

    liquid_color = {
        "hue": phase_color["hue"],
        "saturation": phase_color["saturation"],
        "lightness": phase_color["lightness"],
        "phase": phase,
        "phase_name": cycle_status.get("phase_name", "未知"),
        "description": phase_color["description"]
    }

    # -- ③ 饱和度 (Emotion Temperature) --
    # 真正表达情绪的是颜色饱和度，不是换颜色
    # 身体好 → 颜色鲜艳；压力高 → 颜色变灰
    # 只降低饱和度，绝不换颜色
    if recent_count > 0:
        # 取最近5条记忆的平均情绪强度
        recent_emotions = []
        for m in recent_memories[:10]:
            emos = _parse_emotions(m.emotions)
            for e in emos:
                recent_emotions.append(e.get("intensity", 3))

        if recent_emotions:
            avg_intensity = sum(recent_emotions) / len(recent_emotions)
            # intensity 1-5 → saturation 1.0-0.4
            # intensity 越高（情绪越强烈）→ 饱和度越低（颜色越灰）
            saturation = max(0.4, 1.0 - (avg_intensity - 1) * 0.15)
        else:
            saturation = 0.85  # 默认较高饱和度
    else:
        saturation = 0.6  # 无数据时中等

    # -- ④ 液体运动 (Rhythm) --
    # 运动速度表达生活节奏
    # 记录稳定 → 液体平静；重大事件 → 一次波纹；持续压力 → 轻微震动；非常平稳 → 几乎静止
    if recent_count >= 3:
        # 计算记录间隔的标准差，衡量稳定性
        recent_sorted = sorted(recent_memories, key=lambda m: m.created_at)
        intervals = []
        for i in range(1, len(recent_sorted)):
            delta = (recent_sorted[i].created_at - recent_sorted[i-1].created_at).total_seconds() / 86400  # days
            intervals.append(delta)

        if intervals:
            mean_interval = sum(intervals) / len(intervals)
            variance = sum((x - mean_interval) ** 2 for x in intervals) / len(intervals)
            std_dev = variance ** 0.5

            # 稳定性：标准差越小越稳定
            stability = max(0.0, min(1.0, 1.0 - std_dev / 7.0))

            # 速度：稳定时慢（0.5），不稳定时快（1.2）
            speed = 0.5 + (1.0 - stability) * 0.7

            # 震动幅度：不稳定时增大
            turbulence = 1.0 - stability
        else:
            stability = 0.5
            speed = 0.8
            turbulence = 0.3
    else:
        # 记录不足，默认中等
        stability = 0.5
        speed = 0.8
        turbulence = 0.3

    # 检查最近是否有高强度情绪事件（产生波纹）
    has_recent_spike = False
    if recent_count > 0:
        for m in recent_memories[:3]:
            emos = _parse_emotions(m.emotions)
            for e in emos:
                if e.get("intensity", 3) >= 4:
                    has_recent_spike = True
                    break
            if has_recent_spike:
                break

    if has_recent_spike:
        turbulence = min(1.0, turbulence + 0.3)
        speed = min(1.5, speed + 0.2)

    rhythm = {
        "speed": round(speed, 2),
        "stability": round(stability, 2),
        "turbulence": round(turbulence, 2)
    }

    # -- ⑤ 内部纹理 (Pattern) --
    # 这是 Bubble 真正成长的位置
    # 初始：只有液体
    # 记录一个周期：少量粒子
    # 记录多个周期：形成流线
    # 记录半年：形成层次
    # 记录一年：形成复杂纹理
    # 成长不是越来越大，而是越来越丰富

    # Pattern 需要至少一个完整周期或连续多个相似事件
    theme_counter = {}
    trigger_counter = {}
    recovery_counter = {}

    for m in memories:
        for t in _parse_json_list(m.themes):
            theme_counter[t] = theme_counter.get(t, 0) + 1
        for t in _parse_json_list(m.triggers):
            trigger_counter[t] = trigger_counter.get(t, 0) + 1
        for r in _parse_json_list(m.recovery):
            recovery_counter[r] = recovery_counter.get(r, 0) + 1

    theme_count = len(theme_counter)
    trigger_count = len(trigger_counter)
    recovery_count = len(recovery_counter)
    pattern_richness = theme_count + trigger_count + recovery_count

    # 检查是否有重复出现的 Pattern（至少出现2次）
    repeated_themes = sum(1 for v in theme_counter.values() if v >= 2)
    repeated_triggers = sum(1 for v in trigger_counter.values() if v >= 2)

    # 检查是否有完整周期数据
    has_full_cycle = len(cycles) >= 2

    # Pattern 形成条件：至少有重复出现的主题 OR 有完整周期数据
    has_pattern = repeated_themes >= 1 or repeated_triggers >= 1 or has_full_cycle

    # 纹理层数
    # 0-2条记录: 0层（只有液体）
    # 3-5条: 1层（少量粒子）
    # 6-10条: 2层
    # 11-20条: 3层（形成流线）
    # 21-50条: 4层（形成层次）
    # 50+条: 5-7层（复杂纹理）
    if n <= 2:
        layers = 0
    elif n <= 5:
        layers = 1
    elif n <= 10:
        layers = 2
    elif n <= 20:
        layers = 3
    elif n <= 50:
        layers = 4
    elif n <= 100:
        layers = 5
    elif n <= 200:
        layers = 6
    else:
        layers = 7

    # 如果没有形成 Pattern，层数减半（只有记忆，没有理解）
    if not has_pattern:
        layers = min(layers, 1)

    complexity = min(1.0, pattern_richness / 15.0)

    texture = {
        "layers": layers,
        "complexity": round(complexity, 2),
        "has_pattern": has_pattern,
        "pattern_richness": pattern_richness,
        "repeated_themes": repeated_themes,
        "has_full_cycle": has_full_cycle
    }

    # -- ⑥ 透明度 (Understanding) --
    # 理解越深，Bubble 越透明，视觉更加干净
    # 复杂的是内部纹理，不是整体外观
    # 初始 0.95（不透明）→ 随理解深度降低到 0.3（通透）
    if n == 0:
        transparency = 0.95
    elif not has_pattern:
        # 有记忆但还没形成 Pattern，不太透明
        transparency = max(0.7, 0.95 - n * 0.01)
    else:
        # 形成了 Pattern，开始变透明
        # pattern_richness 越高越透明
        transparency = max(0.3, 0.7 - pattern_richness * 0.03)

    # -- 成长旁白（遵守 Constitution） --
    # AI Duty 2: Pattern 建立后，旁白来自 Pattern 描述而不是简单计数
    detected_patterns = detect_patterns(memories, cycles, today)
    if detected_patterns:
        narration = generate_pattern_narration(detected_patterns)
    else:
        narration = _generate_narration(n, has_pattern, pattern_richness, texture, phase, recent_count)

    return {
        "liquid_height": round(liquid_height, 1),
        "liquid_color": liquid_color,
        "saturation": round(saturation, 2),
        "rhythm": rhythm,
        "texture": texture,
        "transparency": round(transparency, 2),
        "narration": narration,
        "patterns": detected_patterns,
        "constitution": {
            "never_define": CONSTITUTION_RULES["never_define"],
            "never_evaluate": CONSTITUTION_RULES["never_evaluate"],
            "body_first": True,
            "accept_exception": True
        },
        "meta": {
            "total_memories": n,
            "recent_memories_30d": recent_count,
            "cycle_phase": phase,
            "has_pattern": has_pattern,
            "pattern_count": len(detected_patterns)
        }
    }


def _generate_narration(
    n: int,
    has_pattern: bool,
    pattern_richness: int,
    texture: dict,
    phase: str,
    recent_count: int
) -> str:
    """
    生成成长旁白，严格遵守 Bubble Constitution：
    - 不定义用户
    - 不评价
    - 优先相信身体
    - 接受例外
    - 帮助理解自己
    """
    if n == 0:
        return "Bubble 在等你写下第一句"

    if not has_pattern:
        if recent_count > 0:
            return "Bubble 正在收集这些日子"
        return "Bubble 一直记得你"

    if pattern_richness <= 3:
        return "Bubble 开始记住你的节奏了"

    if pattern_richness <= 6:
        return "Bubble 好像发现了一些联系"

    if pattern_richness <= 10:
        return "Bubble 越来越懂你了"

    return "Bubble 想和你分享一些发现"
