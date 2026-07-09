"""认证路由测试

覆盖：
- 注册成功 → 返回 token
- 重复邮箱注册 → 400
- 登录成功 → 返回 token
- 错误密码登录 → 401
- 无 token 访问需要认证的端点 → 401
- 错误 token 访问 → 401
"""
import uuid


def test_register_success(client):
    email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    resp = client.post(
        "/api/auth/register",
        json={"email": email, "password": "secret123", "nickname": "Bob"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "token" in body and isinstance(body["token"], str) and len(body["token"]) > 0
    assert body["user"]["email"] == email
    assert body["user"]["nickname"] == "Bob"
    assert "id" in body["user"]


def test_register_duplicate_email_returns_400(client):
    email = f"dup_{uuid.uuid4().hex[:8]}@example.com"
    first = client.post(
        "/api/auth/register",
        json={"email": email, "password": "secret123"},
    )
    assert first.status_code == 200

    second = client.post(
        "/api/auth/register",
        json={"email": email, "password": "secret123"},
    )
    assert second.status_code == 400


def test_login_success(client):
    email = f"login_{uuid.uuid4().hex[:8]}@example.com"
    pwd = "loginpass123"
    reg = client.post(
        "/api/auth/register",
        json={"email": email, "password": pwd},
    )
    assert reg.status_code == 200

    resp = client.post(
        "/api/auth/login",
        json={"email": email, "password": pwd},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "token" in body and body["token"]
    assert body["user"]["email"] == email


def test_login_wrong_password_returns_401(client):
    email = f"wp_{uuid.uuid4().hex[:8]}@example.com"
    client.post(
        "/api/auth/register",
        json={"email": email, "password": "rightpass"},
    )
    resp = client.post(
        "/api/auth/login",
        json={"email": email, "password": "wrongpass"},
    )
    assert resp.status_code == 401


def test_login_unknown_email_returns_401(client):
    resp = client.post(
        "/api/auth/login",
        json={"email": f"nobody_{uuid.uuid4().hex[:8]}@example.com", "password": "whatever"},
    )
    assert resp.status_code == 401


def test_me_requires_token(client):
    """无 token 访问 /api/auth/me → 401 或 403（FastAPI HTTPBearer 默认 403）。

    我们只断言"认证失败"，对 401/403 不强求一致 — production 的契约是
    任意认证失败（401 或 403）都不能进入业务处理。
    """
    resp = client.get("/api/auth/me")
    assert resp.status_code in (401, 403), f"unexpected {resp.status_code}: {resp.text}"


def test_me_with_invalid_token_returns_401(client):
    """乱写一个 token → 401"""
    resp = client.get(
        "/api/auth/me",
        headers={"Authorization": "Bearer this-is-not-a-jwt"},
    )
    assert resp.status_code == 401


def test_me_with_valid_token_returns_user(client, auth_user):
    """正常 token → 200，返回当前用户"""
    resp = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {auth_user['token']}"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == auth_user["user_id"]
    assert body["email"] == auth_user["email"]


def test_protected_memories_no_token_returns_401(client):
    """访问 /api/memories（需要认证）无 token → 401 或 403（HTTPBearer 默认 403）"""
    resp = client.get("/api/memories")
    assert resp.status_code in (401, 403), f"unexpected {resp.status_code}: {resp.text}"


def test_protected_memories_bad_token_returns_401(client):
    """访问 /api/memories 带错 token → 401"""
    resp = client.get(
        "/api/memories",
        headers={"Authorization": "Bearer garbage.jwt.value"},
    )
    assert resp.status_code == 401