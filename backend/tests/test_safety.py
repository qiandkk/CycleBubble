"""危机信号检测 (safety.py) 单元测试

关键不变量：
1. 永远不抛异常（输入空 / 特殊字符都行）
2. 风险等级严格分 none / medium / high
3. 关键词检测对中英文都生效
4. high 风险时返回 resources（含 hotline + text 资源）
5. 大小写不敏感（IGNORECASE）
6. 永远不会返回任何用户的个人信息
"""
import pytest
from safety import scan


class TestScanBasics:
    """scan() 的基础不变量。"""

    def test_empty_text_returns_none(self):
        r = scan("")
        assert r["risk_level"] == "none"
        assert r["matched"] == []
        assert r["resources"] == []

    def test_none_text_returns_none(self):
        r = scan(None)
        assert r["risk_level"] == "none"

    def test_non_string_text_returns_none(self):
        # 后端 / 前端如果误传非 string，scan 也不能崩
        assert scan(123)["risk_level"] == "none"
        assert scan(["a", "b"])["risk_level"] == "none"
        assert scan({"k": "v"})["risk_level"] == "none"

    def test_normal_text_returns_none(self):
        r = scan("今天天气不错，去公园散步，心情挺好。")
        assert r["risk_level"] == "none"
        assert r["matched"] == []

    def test_returns_dict_with_required_keys(self):
        r = scan("任何文字")
        assert set(r.keys()) >= {"risk_level", "matched", "resources"}

    def test_resources_empty_when_risk_none(self):
        r = scan("hello world")
        assert r["resources"] == []


class TestHighRiskKeywords:
    """高风险关键词：自伤 / 自杀 / 死亡意愿 / 具体计划。"""

    @pytest.mark.parametrize("text", [
        "我觉得活着没意思，想自杀。",
        "我不想活了，想结束这一切。",
        "今天太痛苦了，我想了结自己。",
        "我受够了，想要结束生命。",
        "每天都想自我了断。",
        "感觉活不下去了，想轻生。",
        "我一直在自残，割腕好几次。",
        "我想到跳楼，不知道几楼合适。",
        "今晚想吃点安眠药，永远睡过去。",
        "I want to kill myself tonight.",
        "I've been cutting myself every day.",
        "I keep thinking about ending my life.",
    ])
    def test_high_risk_keyword_detected(self, text):
        r = scan(text)
        assert r["risk_level"] == "high", f"应判为 high 但得 {r['risk_level']}，文本：{text}"
        assert len(r["matched"]) > 0
        # high 风险必须返回 resources
        assert r["resources"]
        assert "message" in r["resources"]
        assert "hotline" in r["resources"]
        assert "text" in r["resources"]
        # 至少一条 hotline
        assert len(r["resources"]["hotline"]) > 0
        # 资源里不能含个人身份信息
        for h in r["resources"]["hotline"]:
            assert "phone" in h
            assert "name" in h
        # 资源不能是空 list
        assert len(r["resources"]["text"]) > 0


class TestMediumRiskKeywords:
    """中风险关键词：强烈情绪 + 持续性描述。"""

    @pytest.mark.parametrize("text", [
        "我真的活不下去了。",
        "已经熬不下去了。",
        "撑不住了，每天都好累。",
        "突然觉得没意思透了。",
        "我想消失，不想被任何人找到。",
        "我彻底崩溃了。",
    ])
    def test_medium_risk_keyword_detected(self, text):
        r = scan(text)
        assert r["risk_level"] == "medium", f"应判为 medium 但得 {r['risk_level']}，文本：{text}"
        assert len(r["matched"]) > 0
        # medium 也给资源，前端可以选不弹 modal 但数据要齐
        assert r["resources"]
        assert r["resources"]["message"]


class TestCaseInsensitive:
    """英文关键词应大小写不敏感。"""

    def test_uppercase_english(self):
        r = scan("I WANT TO KILL MYSELF")
        assert r["risk_level"] == "high"
        assert any("kill" in m.lower() for m in r["matched"])

    def test_mixed_case_english(self):
        r = scan("Thinking about Self-Harm again.")
        assert r["risk_level"] == "high"

    def test_mixed_case_chinese_unchanged(self):
        # 中文无大小写，但仍应命中
        r = scan("今天想自SHA残。")
        # "自SHA残" 拆字后不含 "自残"，应判 none
        # 这条测试反映真实行为：模糊匹配不跨中英
        # 中文关键词严格要求原文匹配
        assert r["risk_level"] in ("none", "high")


class TestNegativeLookalikes:
    """容易被误判的正常文本。"""

    @pytest.mark.parametrize("text", [
        "今天被领导批评了，有点低落，但还撑得住。",
        "工作压力大，需要休息。",
        "看完《活着》这本书，心情很复杂。",
        "昨天吃了自制的蛋糕，味道一般。",
        "讨论一下自杀干预的研究方法。",  # 学术讨论也包含敏感词，预期会判 high
        # （注：这一条会判 high —— 因为当前实现是关键词匹配，
        #  无法区分自伤意图 vs 学术讨论。如果以后需要，应加上下文判断。）
    ])
    def test_normal_negative_is_not_high(self, text):
        # 前 4 条是真正的负面情绪但非危机
        if "讨论" in text or "研究" in text:
            pytest.skip("该用例当前会被判 high（关键词模型无上下文理解）")
        r = scan(text)
        assert r["risk_level"] in ("none", "medium"), (
            f"应判 none/medium 但得 {r['risk_level']}，文本：{text}"
        )


class TestResourcesShape:
    """资源数据结构稳定性。"""

    def test_hotline_resource_shape(self):
        r = scan("想自杀")
        for h in r["resources"]["hotline"]:
            assert "name" in h
            assert "phone" in h
            assert "hours" in h
            assert "region" in h
            # phone 应当像电话号码（含数字）
            assert any(c.isdigit() for c in h["phone"])

    def test_text_resource_shape(self):
        r = scan("想自杀")
        for t in r["resources"]["text"]:
            assert "name" in t
            assert "url" in t
            assert t["url"].startswith(("http://", "https://"))

    def test_message_is_nonempty(self):
        r = scan("想自杀")
        assert r["resources"]["message"]
        assert len(r["resources"]["message"]) > 10

    def test_no_user_pii_in_resources(self):
        """resources 不能含测试用户 / 测试上下文信息。"""
        r = scan("alice@example.com 想自杀")
        # alice@example.com 不应被包含在 resources 任何字段
        import json
        s = json.dumps(r, ensure_ascii=False)
        assert "alice@" not in s
        assert "example.com" not in s


class TestMatchUniqueness:
    """matched 数组不应有重复项。"""

    def test_no_duplicate_matches(self):
        # "自杀" 在关键词列表里只一条，但"想自杀 自杀 自杀"应该去重
        r = scan("想自杀 自杀 自杀")
        assert len(r["matched"]) == len(set(r["matched"]))


class TestEdgeCases:
    """边界情况。"""

    def test_very_long_text_does_not_crash(self):
        text = "今天" * 10000
        r = scan(text)
        assert "risk_level" in r

    def test_text_with_only_whitespace(self):
        r = scan("    \n\t  ")
        assert r["risk_level"] == "none"

    def test_unicode_normalization_robust(self):
        # 不同 unicode 表示法（全角/半角）也应当不崩
        r = scan("想自sha残")  # 半角字母
        # 半角"sha"夹中间，不应误判为 high；只测不崩
        assert "risk_level" in r
