from datetime import date, timedelta
from typing import List, Dict, Any, Optional
from sqlmodel import Session
from .models import Cycle

# 标准 28 天周期
DEFAULT_CYCLE_LENGTH = 28
# 黄体期固定 14 天
LUTEAL_PHASE_LENGTH = 14
# 周期长度合理范围
MIN_CYCLE_LENGTH = 21
MAX_CYCLE_LENGTH = 35

PHASE_NAMES = {
    "menstrual": "月经期",
    "follicular": "卵泡期",
    "ovulation": "排卵期",
    "luteal": "黄体期",
    "unknown": "未知"
}

PHASE_DESCRIPTIONS = {
    "menstrual": "身体正在经历月经，可能需要更多休息",
    "follicular": "精力逐渐恢复，新的开始",
    "ovulation": "能量高峰，社交活跃",
    "luteal": "感受会更敏锐的几天",
    "unknown": "周期数据收集中"
}

def compute_cycle_status(cycles: List[Cycle], today: Optional[date] = None) -> Dict[str, Any]:
    """
    根据历史经期数据计算当前周期状态

    Args:
        cycles: 用户的所有经期记录（按 start_date 升序）
        today: 当前日期（用于测试）

    Returns:
        {
            "phase": "luteal",
            "phase_name": "黄体期",
            "description": "感受会更敏锐的几天",
            "day_in_cycle": 21,
            "days_until_next_period": 7,
            "next_period_date": "2026-07-17",
            "confidence": "high" | "medium" | "low" | "none",
            "cycle_lengths": [28, 30, 27],
            "is_regular": True
        }
    """
    if today is None:
        today = date.today()

    if not cycles:
        return {
            "phase": "unknown",
            "phase_name": "未知",
            "description": PHASE_DESCRIPTIONS["unknown"],
            "day_in_cycle": None,
            "days_until_next_period": None,
            "next_period_date": None,
            "confidence": "none",
            "cycle_lengths": [],
            "is_regular": None
        }

    # 排序：最新的在最后
    cycles = sorted(cycles, key=lambda c: c.start_date)
    n = len(cycles)

    # 置信度
    if n == 1:
        confidence = "low"
    elif 2 <= n <= 5:
        confidence = "medium"
    else:
        confidence = "high"

    # 计算周期长度
    cycle_lengths = []
    for i in range(1, n):
        delta = (cycles[i].start_date - cycles[i-1].start_date).days
        if MIN_CYCLE_LENGTH <= delta <= MAX_CYCLE_LENGTH:
            cycle_lengths.append(delta)

    # 平均周期长度
    if cycle_lengths:
        avg_length = sum(cycle_lengths) // len(cycle_lengths)
    else:
        avg_length = DEFAULT_CYCLE_LENGTH

    # 判断规律性
    if len(cycle_lengths) >= 2:
        mean = avg_length
        variance = sum((x - mean) ** 2 for x in cycle_lengths) / len(cycle_lengths)
        std_dev = variance ** 0.5
        is_regular = std_dev <= 7
    else:
        is_regular = None

    # 最新一次经期开始日期
    latest_start = cycles[-1].start_date
    day_in_cycle = (today - latest_start).days + 1

    # 如果还在月经期（5 天内）
    latest_end = cycles[-1].end_date
    if latest_end and (today - latest_end).days <= 0:
        day_in_cycle = (today - latest_start).days + 1
        if day_in_cycle <= 5:
            return {
                "phase": "menstrual",
                "phase_name": PHASE_NAMES["menstrual"],
                "description": PHASE_DESCRIPTIONS["menstrual"],
                "day_in_cycle": day_in_cycle,
                "days_until_next_period": avg_length - day_in_cycle,
                "next_period_date": (latest_start + timedelta(days=avg_length)).isoformat(),
                "confidence": confidence,
                "cycle_lengths": cycle_lengths,
                "is_regular": is_regular
            }

    # 推算下次经期开始日
    next_period = latest_start + timedelta(days=avg_length)
    days_until_next = (next_period - today).days

    # 阶段判断（以 avg_length 天为周期）
    if day_in_cycle < 0:
        phase = "unknown"
        description = PHASE_DESCRIPTIONS["unknown"]
        day_in_cycle = None
    elif day_in_cycle <= 5:
        phase = "menstrual"
        description = PHASE_DESCRIPTIONS["menstrual"]
    elif day_in_cycle <= avg_length - 16:  # 卵泡期：月经后到排卵前
        phase = "follicular"
        description = PHASE_DESCRIPTIONS["follicular"]
    elif day_in_cycle <= avg_length - 13:  # 排卵期
        phase = "ovulation"
        description = PHASE_DESCRIPTIONS["ovulation"]
    else:
        phase = "luteal"
        description = PHASE_DESCRIPTIONS["luteal"]

    return {
        "phase": phase,
        "phase_name": PHASE_NAMES[phase],
        "description": description,
        "day_in_cycle": day_in_cycle,
        "days_until_next_period": days_until_next if days_until_next > 0 else 0,
        "next_period_date": next_period.isoformat(),
        "confidence": confidence,
        "cycle_lengths": cycle_lengths,
        "is_regular": is_regular
    }


def get_phase_for_text(phase: str) -> str:
    """供前端直接显示的文案：阶段名｜描述"""
    description = PHASE_DESCRIPTIONS.get(phase, PHASE_DESCRIPTIONS["unknown"])
    if phase == "unknown":
        return description
    name = PHASE_NAMES.get(phase, "未知")
    return f"{name}｜{description}"