"""危机信号检测与援助资源

设计原则（参考 frontend-design 流程的"restraint and self-critique"）：
- **永远不阻断**用户保存记录——这是兜底，不是审查
- 关键词分级：高风险（自伤/自杀意念）一定弹出援助资源；中风险（强烈负面
  情绪持续）给轻提示
- 资源是**静态 + 权威**的，不引向商业 / 政治 / 宗教机构
- 隐私：检测完全在请求体内存中完成，**不写日志、不发外部服务**

检测逻辑：扫描 raw_text 中是否出现关键词（多模式 OR 匹配）。
返回：matched 列表 + risk_level + resources 列表（结构化）。

资源库（仅中国大陆地区，**应用前请根据目标地区替换**）：

| 名称 | 电话 | 时间 |
|---|---|---|
| 北京心理危机研究与干预中心 | 010-82951332 | 24h |
| 全国心理援助热线 | 400-161-9995 | 24h |
| 希望24热线 | 400-161-9995 | 24h |
| 生命热线（上海） | 021-12320-5 | 24h |
| 香港撒瑪利亞防止自殺會 | 2389-2222 | 24h |
| 台湾生命线 | 1995（拨打）/ +886-2585-9595 | 24h |

文字资源（不依赖电话）：
- 简单心理（simplecare.cn）：在线心理咨询
- 壹心理（xinli001.com）：心理学科普 + 自助
"""
from typing import List, Dict, Any
import re


# 高风险关键词：自伤 / 自杀 / 死亡意愿 / 具体计划
# 触发时**一定**弹出援助资源 modal
# 每个模式直接做子串匹配（re.escape 防特殊字符），多个词拆成多条避免顺序问题
HIGH_RISK_PATTERNS = [
    # 中文
    r"自杀", r"想死", r"不想活", r"了结自己", r"结束生命",
    r"自我了断", r"轻生", r"自残", r"伤害自己", r"割腕",
    r"跳楼", r"安眠药", r"农药",
    r"活着没意思", r"活够了",
    # 英文（拆词避免顺序问题）
    r"suicide", r"suicidal",
    r"kill myself", r"killing myself",
    r"end my life", r"ending my life",
    r"self harm", r"self-harm", r"selfharm", r"self cut", r"self-cut", r"selfcut",
    r"cut myself", r"cutting myself",
    r"take my life", r"taking my life",
    r"don't want to live", r"don't want to be alive",
    r"want to die",
    r"jump off", r"jump from",
]

# 中风险关键词：强烈情绪 + 持续性描述
# 触发时**只**在保存响应里标记，不弹 modal（让产品其他文案做柔性提示）
MEDIUM_RISK_PATTERNS = [
    r"活不下去", r"熬不下去", r"撑不住", r"没意思",
    r"想消失", r"想逃跑", r"彻底崩溃", r"扛不住",
    r"受不了了", r"没人理解", r"没人要",
    r"hopeless", r"can't go on", r"give up",
]


RESOURCES_HOTLINE = [
    {"name": "全国心理援助热线",        "phone": "400-161-9995", "hours": "24h",  "region": "中国大陆"},
    {"name": "北京心理危机研究与干预中心", "phone": "010-82951332",  "hours": "24h",  "region": "中国大陆"},
    {"name": "生命热线（上海）",         "phone": "021-12320-5",  "hours": "24h",  "region": "中国大陆"},
    {"name": "希望24热线",             "phone": "400-161-9995", "hours": "24h",  "region": "中国大陆"},
]

RESOURCES_TEXT = [
    {"name": "简单心理", "url": "https://www.simplecare.cn",  "desc": "在线心理咨询平台"},
    {"name": "壹心理",   "url": "https://www.xinli001.com", "desc": "心理学科普与自助"},
    {"name": "KnowYourself", "url": "https://www.knowyourself.cc", "desc": "心理学知识科普"},
]

# 编译为正则（IGNORECASE + UNICODE + 子串匹配）
_HIGH_RE = [re.compile(re.escape(p), re.IGNORECASE | re.UNICODE) for p in HIGH_RISK_PATTERNS]
_MED_RE  = [re.compile(re.escape(p), re.IGNORECASE | re.UNICODE) for p in MEDIUM_RISK_PATTERNS]


def scan(text: str) -> Dict[str, Any]:
    """扫描文本，返回：
    {
        "risk_level": "none" | "medium" | "high",
        "matched":   [高风险匹配的关键词...],
        "resources": [...]   # 仅 risk_level == "high" 时返回热线 + 文字资源
    }
    永远返回 dict，从不抛异常。
    """
    if not text or not isinstance(text, str):
        return {"risk_level": "none", "matched": [], "resources": []}

    high_matched = sorted({p for r in _HIGH_RE for p in r.findall(text)})
    med_matched  = sorted({p for r in _MED_RE  for p in r.findall(text)})

    if high_matched:
        return {
            "risk_level": "high",
            "matched": high_matched,
            "resources": {
                "hotline": RESOURCES_HOTLINE,
                "text":    RESOURCES_TEXT,
                "message": (
                    "你刚刚写下的内容，让我们担心你的安全。"
                    "请记得——你不必一个人面对。下面是一些可以立刻联系到的帮助："
                ),
            },
        }
    if med_matched:
        return {
            "risk_level": "medium",
            "matched": med_matched,
            "resources": {
                "hotline": RESOURCES_HOTLINE,
                "text":    RESOURCES_TEXT,
                "message": (
                    "听起来你最近很辛苦。"
                    "如果这些感受持续或加重，跟信任的人聊一聊，或者寻求专业帮助，会有用的。"
                ),
            },
        }
    return {"risk_level": "none", "matched": [], "resources": []}
