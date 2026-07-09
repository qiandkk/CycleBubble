"""共鸣路由测试 —— Phase 1 修复点核心风险

覆盖：
- 对不存在的 ``memory_id`` 发起回应 → 404
- 对**私密** Memory（``is_public=False``）发起回应 → 404
- 对**公开** Memory 发起回应 → 200，返回 ``ok=True``
- 回应时 ``response_type`` 不在合法集合 → 400
"""
import uuid


def _create_memory(client, headers, raw_text: str, is_public: bool) -> str:
    resp = client.post(
        "/api/memories",
        json={"raw_text": raw_text, "is_public": is_public},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    return resp.json()["memory"]["id"]


def test_response_on_nonexistent_memory_returns_404(client, make_auth_headers, auth_user):
    """对一个不存在的 memory_id 发起回应 → 404。"""
    headers = make_auth_headers(auth_user["token"])
    bogus = uuid.uuid4().hex
    resp = client.post(
        f"/api/resonance/{bogus}/responses",
        json={"response_type": "empathy"},
        headers=headers,
    )
    assert resp.status_code == 404


def test_response_on_private_memory_returns_404(client, make_auth_headers, auth_user):
    """私密 Memory 不能被回应 — 必须先公开。"""
    headers = make_auth_headers(auth_user["token"])
    memory_id = _create_memory(client, headers, "这是一条私密记录", is_public=False)

    resp = client.post(
        f"/api/resonance/{memory_id}/responses",
        json={"response_type": "empathy"},
        headers=headers,
    )
    assert resp.status_code == 404


def test_response_on_public_memory_returns_200(client, make_auth_headers, auth_user):
    """公开 Memory 可以被回应 — 返回 ``ok=True``。"""
    headers = make_auth_headers(auth_user["token"])
    memory_id = _create_memory(client, headers, "今天又被领导批评了", is_public=True)

    resp = client.post(
        f"/api/resonance/{memory_id}/responses",
        json={"response_type": "empathy"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body.get("ok") is True
    assert "response_id" in body and body["response_id"]


def test_response_with_invalid_type_returns_400(client, make_auth_headers, auth_user):
    """``response_type`` 不在 ``{empathy,thanks,hug,share}`` → 400。"""
    headers = make_auth_headers(auth_user["token"])
    memory_id = _create_memory(client, headers, "公开记录：想被看见", is_public=True)

    resp = client.post(
        f"/api/resonance/{memory_id}/responses",
        json={"response_type": "banana"},  # 不在合法集合
        headers=headers,
    )
    assert resp.status_code == 400


def test_response_without_auth_returns_401(client):
    """未认证用户尝试回应 → 401 或 403（HTTPBearer 默认 403）"""
    bogus = uuid.uuid4().hex
    resp = client.post(
        f"/api/resonance/{bogus}/responses",
        json={"response_type": "empathy"},
    )
    assert resp.status_code in (401, 403), f"unexpected {resp.status_code}: {resp.text}"


def test_response_all_valid_types_accepted(client, make_auth_headers, auth_user):
    """四个合法 type（empathy / thanks / hug / share）都应被接受。"""
    headers = make_auth_headers(auth_user["token"])
    memory_id = _create_memory(client, headers, "公开：想找人说说话", is_public=True)

    for rt in ("empathy", "thanks", "hug", "share"):
        resp = client.post(
            f"/api/resonance/{memory_id}/responses",
            json={"response_type": rt, "content": "我也遇到过" if rt == "share" else None},
            headers=headers,
        )
        assert resp.status_code == 200, f"{rt} failed: {resp.text}"
        assert resp.json().get("ok") is True