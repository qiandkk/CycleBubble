"""
Pattern Engine — AI Duty 2: 长期 Pattern 建立
=============================================

AI 不分析今天。AI 分析长期。

工作流：
  用户记录 → AI 提取结构化信息 → Bubble 接收 → Pattern 形成 → Bubble 成长

Pattern 形成规则（Bubble Constitution Rule 4）：
  - 一次记录最多影响 Memory，不能直接改变 Pattern
  - Pattern 至少需要：一个完整周期 或 连续多个相似事件
  - 成长不是越来越大，而是越来越丰富

输出：
  Pattern 描述（observational，不是 label）
  遵守 Constitution：
    - 不定义用户
    - 不评价
    - 优先相信身体
    - 接受例外
"""

import json
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional, Tuple
from collections import Counter, defaultdict
from .models import Memory, Cycle
from .cycle_engine import compute_cycle_status, PHASE_NAMES


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
    items = _parse_json_list(s, [])
    result = []
    for item in items:
        if isinstance(item, dict) and "name" in item:
            result.append({
                "name": item["name"],
                "intensity": item.get("intensity", 3)
            })
    return result


def _get_phase_for_date(cycles: List[Cycle], target_date: date) -> str:
    """获取某个日期对应的身体阶段"""
    status = compute_cycle_status(cycles, target_date)
    return status.get("phase", "unknown")


def detect_patterns(
    memories: List[Memory],
    cycles: List[Cycle],
    today: Optional[date] = None
) -> List[Dict[str, Any]]:
    """
    检测长期 Pattern。

    Pattern 类型：
    1. 跨周期重复：同一身体阶段 + 同一主题反复出现
    2. 主题-触发组合：特定主题总是由特定触发引起
    3. 身体-情绪关联：特定身体阶段总是伴随特定情绪
    4. 恢复方式规律：用户倾向于用同一种方式恢复
    5. 关系模式：特定关系对象反复出现在记录中

    返回 Pattern 列表，每个 Pattern 包含：
    - type: Pattern 类型
    - description: 观察性描述（不定义用户）
    - evidence: 支撑证据（原话引用）
    - strength: 强度（0-1）
    - cycle_aware: 是否跨周期
    """
    if today is None:
        today = date.today()

    if not memories or len(memories) < 3:
        return []

    patterns = []

    # 为每条记忆添加身体阶段标签
    memory_with_phase = []
    for m in memories:
        m_date = m.created_at.date() if isinstance(m.created_at, datetime) else m.created_at
        phase = _get_phase_for_date(cycles, m_date)
        memory_with_phase.append({
            "memory": m,
            "phase": phase,
            "themes": _parse_json_list(m.themes),
            "triggers": _parse_json_list(m.triggers),
            "recovery": _parse_json_list(m.recovery),
            "emotions": _parse_emotions(m.emotions),
            "relationship": _parse_json_list(getattr(m, "relationship", "[]")),
            "body_sensation": _parse_json_list(getattr(m, "body_sensation", "[]")),
            "mood": m.mood or "",
            "date": m_date,
        })

    # ============================================================
    # Pattern 1: 跨周期重复 — 同一身体阶段 + 同一主题反复出现
    # ============================================================
    phase_theme_counter = defaultdict(lambda: defaultdict(list))
    for item in memory_with_phase:
        for theme in item["themes"]:
            phase_theme_counter[item["phase"]][theme].append(item)

    for phase, themes in phase_theme_counter.items():
        for theme, items in themes.items():
            if len(items) >= 2:
                # 检查是否跨周期（不同日期相隔超过 20 天）
                dates = [i["date"] for i in items]
                date_span = (max(dates) - min(dates)).days
                cross_cycle = date_span > 20

                if cross_cycle:
                    phase_name = PHASE_NAMES.get(phase, phase)
                    # 观察性描述，不定义用户
                    desc = f"在{phase_name}，关于「{theme}」的记录好像不止一次出现"
                    patterns.append({
                        "type": "cross_cycle_repeat",
                        "description": desc,
                        "evidence": [
                            {
                                "text": i["memory"].raw_text[:80],
                                "date": i["date"].isoformat(),
                                "phase": i["phase"]
                            }
                            for i in items[:3]
                        ],
                        "strength": min(1.0, len(items) / 5.0),
                        "cycle_aware": True,
                        "meta": {
                            "phase": phase,
                            "theme": theme,
                            "occurrences": len(items)
                        }
                    })

    # ============================================================
    # Pattern 2: 主题-触发组合 — 特定主题总是由特定触发引起
    # ============================================================
    theme_trigger_pairs = defaultdict(list)
    for item in memory_with_phase:
        for theme in item["themes"]:
            for trigger in item["triggers"]:
                theme_trigger_pairs[(theme, trigger)].append(item)

    for (theme, trigger), items in theme_trigger_pairs.items():
        if len(items) >= 2:
            desc = f"提到「{theme}」的时候，好像常常和「{trigger}」一起出现"
            patterns.append({
                "type": "theme_trigger_pair",
                "description": desc,
                "evidence": [
                    {
                        "text": i["memory"].raw_text[:80],
                        "date": i["date"].isoformat()
                    }
                    for i in items[:3]
                ],
                "strength": min(1.0, len(items) / 4.0),
                "cycle_aware": False,
                "meta": {
                    "theme": theme,
                    "trigger": trigger,
                    "occurrences": len(items)
                }
            })

    # ============================================================
    # Pattern 3: 身体-情绪关联 — 特定身体阶段伴随特定情绪
    # ============================================================
    phase_emotion_counter = defaultdict(lambda: defaultdict(list))
    for item in memory_with_phase:
        for emo in item["emotions"]:
            phase_emotion_counter[item["phase"]][emo["name"]].append(item)

    for phase, emotions in phase_emotion_counter.items():
        for emo_name, items in emotions.items():
            if len(items) >= 2:
                phase_name = PHASE_NAMES.get(phase, phase)
                # Constitution Rule 2: 优先相信身体
                desc = f"在{phase_name}，「{emo_name}」的感受似乎更容易出现"
                patterns.append({
                    "type": "phase_emotion_link",
                    "description": desc,
                    "evidence": [
                        {
                            "text": i["memory"].raw_text[:80],
                            "date": i["date"].isoformat(),
                            "phase": i["phase"]
                        }
                        for i in items[:3]
                    ],
                    "strength": min(1.0, len(items) / 4.0),
                    "cycle_aware": True,
                    "meta": {
                        "phase": phase,
                        "emotion": emo_name,
                        "occurrences": len(items)
                    }
                })

    # ============================================================
    # Pattern 4: 恢复方式规律 — 用户倾向于用同一种方式恢复
    # ============================================================
    recovery_counter = Counter()
    recovery_evidence = defaultdict(list)
    for item in memory_with_phase:
        for r in item["recovery"]:
            recovery_counter[r] += 1
            recovery_evidence[r].append(item)

    for r, count in recovery_counter.most_common(3):
        if count >= 2:
            items = recovery_evidence[r]
            desc = f"你好像会反复用「{r}」来让自己好起来"
            patterns.append({
                "type": "recovery_pattern",
                "description": desc,
                "evidence": [
                    {
                        "text": i["memory"].raw_text[:80],
                        "date": i["date"].isoformat()
                    }
                    for i in items[:3]
                ],
                "strength": min(1.0, count / 5.0),
                "cycle_aware": False,
                "meta": {
                    "recovery": r,
                    "occurrences": count
                }
            })

    # ============================================================
    # Pattern 5: 关系模式 — 特定关系对象反复出现
    # ============================================================
    relationship_counter = Counter()
    relationship_evidence = defaultdict(list)
    for item in memory_with_phase:
        for rel in item["relationship"]:
            relationship_counter[rel] += 1
            relationship_evidence[rel].append(item)

    for rel, count in relationship_counter.most_common(3):
        if count >= 2:
            items = relationship_evidence[rel]
            desc = f"关于「{rel}」的记录，好像不止一次出现"
            patterns.append({
                "type": "relationship_pattern",
                "description": desc,
                "evidence": [
                    {
                        "text": i["memory"].raw_text[:80],
                        "date": i["date"].isoformat()
                    }
                    for i in items[:3]
                ],
                "strength": min(1.0, count / 4.0),
                "cycle_aware": False,
                "meta": {
                    "relationship": rel,
                    "occurrences": count
                }
            })

    # ============================================================
    # Pattern 6: 身体感受-阶段关联 — 特定身体感受在特定阶段反复出现
    # ============================================================
    phase_body_counter = defaultdict(lambda: defaultdict(list))
    for item in memory_with_phase:
        for bs in item["body_sensation"]:
            phase_body_counter[item["phase"]][bs].append(item)

    for phase, sensations in phase_body_counter.items():
        for bs, items in sensations.items():
            if len(items) >= 2:
                phase_name = PHASE_NAMES.get(phase, phase)
                desc = f"在{phase_name}，「{bs}」的身体感受好像反复出现"
                patterns.append({
                    "type": "phase_body_link",
                    "description": desc,
                    "evidence": [
                        {
                            "text": i["memory"].raw_text[:80],
                            "date": i["date"].isoformat(),
                            "phase": i["phase"]
                        }
                        for i in items[:3]
                    ],
                    "strength": min(1.0, len(items) / 4.0),
                    "cycle_aware": True,
                    "meta": {
                        "phase": phase,
                        "body_sensation": bs,
                        "occurrences": len(items)
                    }
                })

    # 按强度排序，取前 10 个
    patterns.sort(key=lambda p: p["strength"], reverse=True)
    return patterns[:10]


def compute_pattern_similarity(
    memories_a: List[Memory],
    memories_b: List[Memory],
    cycles_a: List[Cycle] = None,
    cycles_b: List[Cycle] = None
) -> float:
    """
    计算两组记忆之间的 Pattern 相似度（用于共鸣推荐）。

    相似度依据（不是兴趣，不是算法，而是身体背景 + Pattern 相似度）：
    1. 主题重叠度（Jaccard 系数）
    2. 触发因素重叠度
    3. 恢复方式重叠度
    4. 身体阶段一致性（如果两组都有周期数据）
    5. 情绪基调相似度

    返回 0-1 的相似度分数。
    """
    cycles_a = cycles_a or []
    cycles_b = cycles_b or []

    if not memories_a or not memories_b:
        return 0.0

    # 提取主题/触发/恢复/情绪集合
    def extract_sets(memories):
        themes = set()
        triggers = set()
        recovery = set()
        emotions = set()
        for m in memories:
            themes.update(_parse_json_list(m.themes))
            triggers.update(_parse_json_list(m.triggers))
            recovery.update(_parse_json_list(m.recovery))
            for e in _parse_emotions(m.emotions):
                emotions.add(e["name"])
        return themes, triggers, recovery, emotions

    themes_a, triggers_a, recovery_a, emotions_a = extract_sets(memories_a)
    themes_b, triggers_b, recovery_b, emotions_b = extract_sets(memories_b)

    # Jaccard 相似度
    def jaccard(set_a, set_b):
        if not set_a and not set_b:
            return 0.0
        union = set_a | set_b
        if not union:
            return 0.0
        return len(set_a & set_b) / len(union)

    theme_sim = jaccard(themes_a, themes_b)
    trigger_sim = jaccard(triggers_a, triggers_b)
    recovery_sim = jaccard(recovery_a, recovery_b)
    emotion_sim = jaccard(emotions_a, emotions_b)

    # 身体阶段一致性
    phase_sim = 0.0
    if cycles_a and cycles_b:
        status_a = compute_cycle_status(cycles_a)
        status_b = compute_cycle_status(cycles_b)
        phase_a = status_a.get("phase", "unknown")
        phase_b = status_b.get("phase", "unknown")
        if phase_a != "unknown" and phase_b != "unknown":
            phase_sim = 1.0 if phase_a == phase_b else 0.3

    # 加权平均（身体背景 + Pattern 相似度）
    # Constitution: 推荐依据是身体背景 + Pattern 相似度
    weights = {
        "theme": 0.30,
        "trigger": 0.20,
        "recovery": 0.15,
        "emotion": 0.15,
        "phase": 0.20,
    }

    similarity = (
        theme_sim * weights["theme"] +
        trigger_sim * weights["trigger"] +
        recovery_sim * weights["recovery"] +
        emotion_sim * weights["emotion"] +
        phase_sim * weights["phase"]
    )

    return round(similarity, 3)


def generate_pattern_narration(patterns: List[Dict[str, Any]]) -> str:
    """
    根据 Pattern 生成成长旁白。

    遵守 Bubble Constitution：
    - 不定义用户
    - 不评价
    - 帮助理解自己
    - 观察性表达，开放性结论
    """
    if not patterns:
        return "Bubble 正在收集这些日子"

    cross_cycle = [p for p in patterns if p.get("cycle_aware")]
    if cross_cycle:
        strongest = cross_cycle[0]
        return strongest["description"]

    if len(patterns) >= 3:
        return "Bubble 好像发现了一些联系"

    if patterns:
        return patterns[0]["description"]

    return "Bubble 开始记住你的节奏了"
