"""共享 fixtures：临时 sqlite + JWT secret 注入 + auth helpers

设计要点：
- ``CB_JWT_SECRET`` / ``CB_DATABASE_URL`` 在 import backend.* 之前注入到 os.environ，
  走 pydantic-settings 的 import-time 构造，保证 engine / settings 用测试环境
- 整个测试会话共用一个临时 sqlite 文件（避免重建 engine 的复杂操作），
  每个测试通过 ``db_session`` 或直接 ``Session(engine)`` 操作，session 函数级
  fixture 在每个测试前清空所有表，确保测试之间互不污染
- 临时文件在 session 结束时通过 dispose+unlink 清理（先 dispose 是因为 Windows
  上 sqlite 连接会锁文件，单纯 unlink 会失败）
- 同时清空历史 pytest run 残留的 cb_test_*.sqlite，避免污染 /tmp
"""
import glob
import os
import sys
import uuid
from pathlib import Path

# —— 在 import backend.* 之前注入测试环境变量 ——
# 这些值必须足够长才能通过 pydantic 校验（jwt_secret 禁止空/纯空白）
TEST_DB_DIR = Path(os.environ.get("TMP") or os.environ.get("TEMP") or "/tmp") / "cyclebubble_test"
TEST_DB_DIR.mkdir(parents=True, exist_ok=True)
# 先清掉历史 pytest run 残留的临时 sqlite 文件（避免 /tmp 累积污染）
for old in glob.glob(str(TEST_DB_DIR / "cb_test_*.sqlite")):
    try:
        os.unlink(old)
    except OSError:
        pass
TEST_DB_FILE = TEST_DB_DIR / f"cb_test_{uuid.uuid4().hex}.sqlite"
os.environ["CB_DATABASE_URL"] = f"sqlite:///{TEST_DB_FILE}"
os.environ["CB_JWT_SECRET"] = "test-secret-not-real-prod-key-32chars+"
os.environ.setdefault("CB_DEEPSEEK_API_KEY", "")  # 强制走 _fallback_extract

# 把 backend 目录加进 sys.path，让 ``from xxx import ...`` 能解析
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlmodel import Session, SQLModel  # noqa: E402

# 现在才 import backend.* —— 此时 settings 已读入测试环境变量
from database import engine, init_db  # noqa: E402
from main import app  # noqa: E402
from models import User, Memory, Response as ResponseModel, Cycle  # noqa: E402
from auth import create_token  # noqa: E402


# 整个 session 用同一个 TestClient 和 engine（import-time 单例）
@pytest.fixture(scope="session", autouse=True)
def _init_test_db():
    """session 开始时建表，结束时 dispose engine 再删文件。"""
    init_db()
    yield
    # 必须先 dispose 所有连接，否则 Windows 下 sqlite 文件被锁无法 unlink
    engine.dispose()
    try:
        TEST_DB_FILE.unlink()
    except OSError:
        pass


@pytest.fixture(autouse=True)
def _clean_tables():
    """每个测试前清空所有表，保证测试隔离。"""
    with Session(engine) as session:
        for table in reversed(SQLModel.metadata.sorted_tables):
            session.exec(table.delete())
        session.commit()
    yield


@pytest.fixture
def client() -> TestClient:
    """FastAPI TestClient，复用单例 app。"""
    return TestClient(app)


@pytest.fixture
def db_session():
    """直连测试 sqlite 的 Session，可绕过 HTTP 层操作 DB。"""
    s = Session(engine)
    try:
        yield s
    finally:
        s.close()


def _register_user(client: TestClient, email: str, password: str = "testpass123", nickname: str | None = None) -> dict:
    resp = client.post(
        "/api/auth/register",
        json={"email": email, "password": password, "nickname": nickname},
    )
    assert resp.status_code == 200, f"register failed: {resp.status_code} {resp.text}"
    return resp.json()


@pytest.fixture
def auth_user(client):
    """注册一个测试用户并返回 ``{user_id, email, token}``。"""
    email = f"alice_{uuid.uuid4().hex[:8]}@example.com"
    data = _register_user(client, email=email, nickname="Alice")
    return {"user_id": data["user"]["id"], "email": email, "token": data["token"]}


@pytest.fixture
def make_auth_headers():
    """返回一个把 token 包装成 ``Authorization`` 头的 callable。"""

    def _make(token: str) -> dict:
        return {"Authorization": f"Bearer {token}"}

    return _make


@pytest.fixture
def public_memory(client, auth_user, make_auth_headers):
    """给当前 ``auth_user`` 写一条 ``is_public=True`` 的 Memory，返回 memory_id。"""
    headers = make_auth_headers(auth_user["token"])
    resp = client.post(
        "/api/memories",
        json={"raw_text": "今天心情很低落，工作上又被批评了", "is_public": True},
        headers=headers,
    )
    assert resp.status_code == 200, f"create public memory failed: {resp.status_code} {resp.text}"
    return resp.json()["memory"]["id"]