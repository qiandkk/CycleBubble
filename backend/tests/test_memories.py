"""记忆 / 成长路由测试 —— Phase 1 修复点核心风险

覆盖：``accompanied_count`` 的方向必须正确 —— 只统计"我的 Memory 被回应"，
而不是"我回应了多少人"。两个断言必须同时通过，证明方向修对了。
"""
import uuid


def _register(client, email: str, password: str = "testpass123") -> dict:
    resp = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "nickname": email.split("@")[0]},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_growth_accompanied_count_only_counts_responses_on_my_memory(client):
    """A 写公开 Memory → B 在 A 的 Memory 上回应。

    断言：
    - A 的 ``impact.accompanied_count == 1``（被人回应）
    - B 的 ``impact.accompanied_count == 0``（回应别人不算）
    """
    # 注册两个用户
    user_a = _register(client, f"a_{uuid.uuid4().hex[:8]}@example.com")
    user_b = _register(client, f"b_{uuid.uuid4().hex[:8]}@example.com")

    headers_a = {"Authorization": f"Bearer {user_a['token']}"}
    headers_b = {"Authorization": f"Bearer {user_b['token']}"}

    # A 写一条公开 Memory
    create_a = client.post(
        "/api/memories",
        json={"raw_text": "今天心情很低落，工作上又被批评了，想找人说说话", "is_public": True},
        headers=headers_a,
    )
    assert create_a.status_code == 200, create_a.text
    memory_id = create_a.json()["memory"]["id"]

    # B 在 A 的 Memory 上发回应
    resp_b = client.post(
        f"/api/resonance/{memory_id}/responses",
        json={"response_type": "empathy"},
        headers=headers_b,
    )
    assert resp_b.status_code == 200, resp_b.text

    # 检查 A 的成长页：应当有人回应
    growth_a = client.get("/api/growth", headers=headers_a)
    assert growth_a.status_code == 200, growth_a.text
    impact_a = growth_a.json()["impact"]
    assert impact_a["accompanied_count"] == 1, (
        f"A 应当有 1 个回应（被人回应），实际 {impact_a}"
    )

    # 检查 B 的成长页：B 没有 Memory 被回应
    growth_b = client.get("/api/growth", headers=headers_b)
    assert growth_b.status_code == 200, growth_b.text
    impact_b = growth_b.json()["impact"]
    assert impact_b["accompanied_count"] == 0, (
        f"B 不应当被记作陪伴了 A（方向错了），实际 {impact_b}"
    )


def test_growth_accompanied_count_increments_with_multiple_responders(client):
    """A 写一条公开 Memory，B1 B2 B3 都在上面回应 → A 的 accompanied_count == 3。"""
    user_a = _register(client, f"a_{uuid.uuid4().hex[:8]}@example.com")
    b_tokens = [
        _register(client, f"b{i}_{uuid.uuid4().hex[:8]}@example.com")["token"]
        for i in range(3)
    ]

    headers_a = {"Authorization": f"Bearer {user_a['token']}"}
    create_a = client.post(
        "/api/memories",
        json={"raw_text": "今天想找个人说说话", "is_public": True},
        headers=headers_a,
    )
    assert create_a.status_code == 200, create_a.text
    memory_id = create_a.json()["memory"]["id"]

    for tok in b_tokens:
        r = client.post(
            f"/api/resonance/{memory_id}/responses",
            json={"response_type": "hug"},
            headers={"Authorization": f"Bearer {tok}"},
        )
        assert r.status_code == 200, r.text

    growth_a = client.get("/api/growth", headers=headers_a)
    assert growth_a.json()["impact"]["accompanied_count"] == 3


def test_growth_accompanied_count_ignores_responses_on_private_memory(client):
    """A 写**私密** Memory，B 在上面回应 → 因为私密不可回应，B 的请求会 404，
    所以最后 A 的 accompanied_count 仍为 0。"""
    user_a = _register(client, f"a_{uuid.uuid4().hex[:8]}@example.com")
    user_b = _register(client, f"b_{uuid.uuid4().hex[:8]}@example.com")

    headers_a = {"Authorization": f"Bearer {user_a['token']}"}
    headers_b = {"Authorization": f"Bearer {user_b['token']}"}

    create_a = client.post(
        "/api/memories",
        json={"raw_text": "不想被别人看到的私密记录", "is_public": False},
        headers=headers_a,
    )
    assert create_a.status_code == 200, create_a.text
    memory_id = create_a.json()["memory"]["id"]

    # 私密 Memory 不能被回应
    resp_b = client.post(
        f"/api/resonance/{memory_id}/responses",
        json={"response_type": "empathy"},
        headers=headers_b,
    )
    assert resp_b.status_code == 404

    growth_a = client.get("/api/growth", headers=headers_a)
    assert growth_a.json()["impact"]["accompanied_count"] == 0


def test_growth_empty_for_new_user(client):
    """全新用户没有任何 Memory → accompanied_count == 0，timeline 没有 earliest/latest。"""
    user = _register(client, f"new_{uuid.uuid4().hex[:8]}@example.com")
    headers = {"Authorization": f"Bearer {user['token']}"}

    resp = client.get("/api/growth", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["impact"]["accompanied_count"] == 0
    assert body["timeline"]["earliest"] is None
    assert body["timeline"]["latest"] is None
    assert body["timeline"]["hidden_count"] == 0


def test_list_memories_only_returns_my_own(client):
    """列出 Memory 时只返回当前用户自己的。"""
    user_a = _register(client, f"a_{uuid.uuid4().hex[:8]}@example.com")
    user_b = _register(client, f"b_{uuid.uuid4().hex[:8]}@example.com")

    headers_a = {"Authorization": f"Bearer {user_a['token']}"}
    headers_b = {"Authorization": f"Bearer {user_b['token']}"}

    client.post(
        "/api/memories",
        json={"raw_text": "A 的记录 1", "is_public": False},
        headers=headers_a,
    )
    client.post(
        "/api/memories",
        json={"raw_text": "A 的记录 2", "is_public": True},
        headers=headers_a,
    )
    client.post(
        "/api/memories",
        json={"raw_text": "B 的记录", "is_public": True},
        headers=headers_b,
    )

    list_a = client.get("/api/memories", headers=headers_a).json()
    assert list_a["total"] == 2
    assert all("A 的记录" in m["rawText"] for m in list_a["memories"])

    list_b = client.get("/api/memories", headers=headers_b).json()
    assert list_b["total"] == 1
    assert "B 的记录" in list_b["memories"][0]["rawText"]