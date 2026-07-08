"""周期阶段计算引擎测试 —— 边界值

覆盖：
- ``_confidence_for_count(0..6+)`` 各级别
- ``_determine_phase`` 五种阶段的判定
- ``compute_cycle_status`` 各种场景
- 周期长度超过 ``MAX_CYCLE_LENGTH=35`` 应被钳制
"""
from datetime import datetime, timedelta

from cycle_engine import (
    _confidence_for_count,
    _determine_phase,
    compute_cycle_status,
    MAX_CYCLE_LENGTH,
    MIN_CYCLE_LENGTH,
    DEFAULT_CYCLE_LENGTH,
    to_naive_utc,
)


# —— _confidence_for_count ——

def test_confidence_zero_is_none():
    assert _confidence_for_count(0) == "none"


def test_confidence_one_is_low():
    assert _confidence_for_count(1) == "low"


def test_confidence_two_to_five_is_medium():
    for n in (2, 3, 4, 5):
        assert _confidence_for_count(n) == "medium", f"n={n}"


def test_confidence_six_is_high():
    assert _confidence_for_count(6) == "high"


def test_confidence_large_is_high():
    assert _confidence_for_count(50) == "high"


# —— _determine_phase 边界 ——

def test_determine_phase_day1_is_menstrual():
    p = _determine_phase(cycle_day=1, cycle_length=28, ovulation_day=14)
    assert p["key"] == "menstrual"


def test_determine_phase_day7_is_follicular():
    """28 天周期，ov=14 → 第 7 天应为卵泡期。"""
    p = _determine_phase(cycle_day=7, cycle_length=28, ovulation_day=14)
    assert p["key"] == "follicular"


def test_determine_phase_day14_is_ovulation():
    """排卵日当天应是 ovulation。"""
    p = _determine_phase(cycle_day=14, cycle_length=28, ovulation_day=14)
    assert p["key"] == "ovulation"


def test_determine_phase_day20_is_luteal():
    """28 天周期第 20 天 → 黄体期。"""
    p = _determine_phase(cycle_day=20, cycle_length=28, ovulation_day=14)
    assert p["key"] == "luteal"


def test_determine_phase_day35_is_late():
    """超过 cycle_length → 经期临近/逾期。"""
    p = _determine_phase(cycle_day=35, cycle_length=28, ovulation_day=14)
    assert p["key"] == "late"


def test_determine_phase_day0_is_pre_period():
    """cycle_day < 1 的边界保护。"""
    p = _determine_phase(cycle_day=0, cycle_length=28, ovulation_day=14)
    assert p["key"] == "pre_period"


def test_determine_phase_day13_is_ovulation():
    """ov_low = 14 - 1 = 13，应在 ovulation 区间。"""
    p = _determine_phase(cycle_day=13, cycle_length=28, ovulation_day=14)
    assert p["key"] == "ovulation"


def test_determine_phase_day15_is_ovulation():
    """ov_high = 14 + 1 = 15，应在 ovulation 区间。"""
    p = _determine_phase(cycle_day=15, cycle_length=28, ovulation_day=14)
    assert p["key"] == "ovulation"


def test_determine_phase_day5_is_menstrual():
    """第 5 天（典型月经期最后一天）。"""
    p = _determine_phase(cycle_day=5, cycle_length=28, ovulation_day=14)
    assert p["key"] == "menstrual"


def test_determine_phase_day6_is_follicular():
    """第 6 天 = MENSTRUAL_LENGTH + 1 = 卵泡期起点。"""
    p = _determine_phase(cycle_day=6, cycle_length=28, ovulation_day=14)
    assert p["key"] == "follicular"


# —— compute_cycle_status ——

def test_compute_cycle_status_empty_has_no_data():
    result = compute_cycle_status([])
    assert result["has_data"] is False
    assert result["confidence"] == "none"
    assert result["phase"] is None
    assert result["cycle_day"] is None
    assert result["record_count"] == 0


def test_compute_cycle_status_single_record_is_low_confidence():
    """单条记录：confidence=low，phase 用默认周期推算。"""
    now = datetime(2026, 6, 1, 12, 0, 0)
    starts = [now - timedelta(days=5)]  # 5 天前经期开始 → cycle_day = 6（follicular）

    result = compute_cycle_status(starts, now=now)
    assert result["has_data"] is True
    assert result["confidence"] == "low"
    assert result["record_count"] == 1
    assert result["cycle_length"] == DEFAULT_CYCLE_LENGTH  # 单条用默认 28
    # 注入 now 时，cycle_day 应能反映 now-last_start
    assert result["cycle_day"] == 6


def test_compute_cycle_status_six_records_is_high_confidence():
    """≥6 条记录 → confidence=high，is_regular 应能计算（True 或 False 都算）。"""
    now = datetime(2026, 6, 1)
    # 6 条经期开始：第 1 条远在过去，每条间隔稳定 28 天
    starts = [now - timedelta(days=28 * i) for i in range(6)][::-1]

    result = compute_cycle_status(starts, now=now)
    assert result["confidence"] == "high"
    assert result["record_count"] == 6
    assert result["is_regular"] in (True, False)


def test_compute_cycle_status_six_stable_cycles_is_regular_true():
    """6 条间隔稳定的 28 天周期 → is_regular 应为 True。"""
    now = datetime(2026, 6, 1)
    starts = [now - timedelta(days=28 * i) for i in range(6)][::-1]  # 升序

    result = compute_cycle_status(starts, now=now)
    assert result["confidence"] == "high"
    # 5 个 28 天的差，标准差 = 0 → 必为 True
    assert result["is_regular"] is True


def test_compute_cycle_status_six_unstable_cycles_is_regular_false():
    """6 条间隔极度不稳定的周期 → is_regular 应为 False。"""
    now = datetime(2026, 6, 1)
    # 间隔序列：10, 50, 12, 50, 12 — 标准差大
    deltas = [10, 50, 12, 50, 12]
    starts_rev = []  # 从最近往最远
    cursor = now
    for d in deltas:
        starts_rev.append(cursor)
        cursor = cursor - timedelta(days=d)
    starts = list(reversed(starts_rev))  # 升序
    starts.insert(0, starts[0] - timedelta(days=28))  # 加一条起点

    result = compute_cycle_status(starts, now=now)
    assert result["confidence"] == "high"
    assert result["is_regular"] is False


def test_compute_cycle_status_max_cycle_length_clamped():
    """平均周期长度超过 35 天的异常值应被钳制到 MAX_CYCLE_LENGTH。"""
    now = datetime(2026, 6, 1)
    # 3 条记录：两次间隔都是 90 天，平均 90 → 钳制到 35
    starts = [
        now - timedelta(days=270),
        now - timedelta(days=180),
        now - timedelta(days=90),
    ]

    result = compute_cycle_status(starts, now=now)
    assert result["cycle_length"] == MAX_CYCLE_LENGTH
    assert result["cycle_length"] == 35


def test_compute_cycle_status_min_cycle_length_clamped():
    """平均周期长度低于 21 天的异常值应被钳制到 MIN_CYCLE_LENGTH。"""
    now = datetime(2026, 6, 1)
    # 3 条记录：两次间隔都是 5 天，平均 5 → 钳制到 21
    starts = [
        now - timedelta(days=20),
        now - timedelta(days=15),
        now - timedelta(days=10),
    ]

    result = compute_cycle_status(starts, now=now)
    assert result["cycle_length"] == MIN_CYCLE_LENGTH
    assert result["cycle_length"] == 21


def test_compute_cycle_status_records_aware_datetime_accepted():
    """aware datetime 应被统一到 naive UTC（to_naive_utc 已覆盖，这里端到端测一遍）。"""
    from datetime import timezone

    now = datetime(2026, 6, 1, 12, 0, 0, tzinfo=timezone.utc)
    starts = [datetime(2026, 5, 20, 12, 0, 0, tzinfo=timezone.utc)]

    result = compute_cycle_status(starts, now=now)
    assert result["has_data"] is True
    assert result["cycle_day"] == 13  # 5/20 → 6/1 = 12 天后… 但用 utc 算（参见 (now-start)+1）
    # 实际：(6/1 - 5/20) = 12 天，cycle_day = 12 + 1 = 13
    # 注意：5/20 12:00 → 6/1 12:00 整 12 天 + 1 = 13
    # 13 天在 ov_low=13~ov_high=15 → ovulation
    assert result["phase"]["key"] == "ovulation"


def test_compute_cycle_status_phase_when_far_into_luteal():
    """中段周期 → 应处于黄体期。"""
    now = datetime(2026, 6, 1)
    starts = [now - timedelta(days=20)]  # 第 21 天
    result = compute_cycle_status(starts, now=now)
    assert result["phase"]["key"] == "luteal"


def test_compute_cycle_status_ovulation_day_calculation():
    """``ovulation_day = cycle_length - LUTEAL_PHASE_LENGTH(14)``。"""
    now = datetime(2026, 6, 1)
    starts = [now - timedelta(days=15)]
    result = compute_cycle_status(starts, now=now)
    # 单条 → 默认 28 天 → 排卵日 = 28 - 14 = 14
    assert result["ovulation_day"] == 14


def test_compute_cycle_status_next_period_date():
    """``next_period_date = last_start + cycle_length``。"""
    now = datetime(2026, 6, 1)
    last_start = now - timedelta(days=5)
    result = compute_cycle_status([last_start], now=now)
    expected = (last_start + timedelta(days=DEFAULT_CYCLE_LENGTH)).isoformat()
    assert result["next_period_date"] == expected


def test_compute_cycle_status_cycle_lengths_listed():
    """``cycle_lengths`` 应包含所有相邻差。"""
    now = datetime(2026, 6, 1)
    starts = [
        now - timedelta(days=60),
        now - timedelta(days=30),  # 间隔 30
        now - timedelta(days=2),   # 间隔 28
    ]
    result = compute_cycle_status(starts, now=now)
    assert result["cycle_lengths"] == [30, 28]


# —— to_naive_utc ——

def test_to_naive_utc_naive_passthrough():
    dt = datetime(2026, 1, 1, 12, 0, 0)
    assert to_naive_utc(dt) == dt
    assert to_naive_utc(dt).tzinfo is None


def test_to_naive_utc_aware_to_naive_utc():
    from datetime import timezone, timedelta as td

    utc = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    result = to_naive_utc(utc)
    assert result.tzinfo is None
    assert result == datetime(2026, 1, 1, 12, 0, 0)

    # 非 UTC aware → 转换后仍是同一物理时刻
    beijing = timezone(td(hours=8))
    bj = datetime(2026, 1, 1, 20, 0, 0, tzinfo=beijing)  # = 12:00 UTC
    result2 = to_naive_utc(bj)
    assert result2 == datetime(2026, 1, 1, 12, 0, 0)