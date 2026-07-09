"""reports + cycle 修正 + resonance 频控 测试"""
import pytest
from datetime import datetime, timedelta


# ===================================================================
# Reports（用户举报）
# ===================================================================
class TestReports:
    def test_create_report_ok(self, client, public_memory, auth_user, make_auth_headers):
        headers = make_auth_headers(auth_user["token"])
        r = client.post(
            "/api/reports",
            json={"memory_id": public_memory, "reason": "spam"},
            headers=headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["duplicate"] is False
        assert "report_id" in body

    def test_create_report_invalid_reason_rejected(self, client, public_memory, auth_user, make_auth_headers):
        headers = make_auth_headers(auth_user["token"])
        r = client.post(
            "/api/reports",
            json={"memory_id": public_memory, "reason": "not_a_real_reason"},
            headers=headers,
        )
        assert r.status_code == 400
        assert "无效" in r.json()["detail"]

    def test_create_report_memory_not_found(self, client, auth_user, make_auth_headers):
        headers = make_auth_headers(auth_user["token"])
        r = client.post(
            "/api/reports",
            json={"memory_id": "00000000-0000-0000-0000-000000000000", "reason": "spam"},
            headers=headers,
        )
        assert r.status_code == 404

    def test_duplicate_report_returns_existing(self, client, public_memory, auth_user, make_auth_headers):
        headers = make_auth_headers(auth_user["token"])
        r1 = client.post("/api/reports", json={"memory_id": public_memory, "reason": "spam"}, headers=headers)
        r2 = client.post("/api/reports", json={"memory_id": public_memory, "reason": "harassment"}, headers=headers)
        assert r1.status_code == 200
        assert r2.status_code == 200
        assert r1.json()["report_id"] == r2.json()["report_id"]
        assert r2.json()["duplicate"] is True

    def test_list_my_reports(self, client, public_memory, auth_user, make_auth_headers):
        headers = make_auth_headers(auth_user["token"])
        client.post("/api/reports", json={"memory_id": public_memory, "reason": "spam"}, headers=headers)
        r = client.get("/api/reports/me", headers=headers)
        assert r.status_code == 200
        body = r.json()
        assert body["total"] >= 1
        assert body["reports"][0]["reason"] == "spam"

    def test_report_unauthenticated_rejected(self, client, public_memory):
        r = client.post(
            "/api/reports",
            json={"memory_id": public_memory, "reason": "spam"},
        )
        assert r.status_code in (401, 403)


# ===================================================================
# Cycle 修正（PATCH / DELETE）
# ===================================================================
def _add_period(client, headers, iso_date):
    r = client.post(
        "/api/cycle/periods",
        json={"period_start": iso_date + "T00:00:00"},
        headers=headers,
    )
    assert r.status_code == 200, r.text
    return r.json()["cycle"]


class TestCycleCorrect:
    def test_patch_changes_date_and_recomputes_lengths(self, client, auth_user, make_auth_headers):
        headers = make_auth_headers(auth_user["token"])
        # 3 条经期：day 1, day 30, day 60
        c1 = _add_period(client, headers, "2026-01-01")
        c2 = _add_period(client, headers, "2026-01-31")  # 距 c1 30 天
        c3 = _add_period(client, headers, "2026-03-02")  # 距 c2 30 天

        # 把 c2 改成 2026-02-15：c1 距 c2 应 = 45, c2 距 c3 应 = 15
        r = client.patch(
            f"/api/cycle/periods/{c2['id']}",
            json={"period_start": "2026-02-15T00:00:00"},
            headers=headers,
        )
        assert r.status_code == 200, r.text

        # 重新 list 验证
        lst = client.get("/api/cycle/periods", headers=headers).json()["periods"]
        by_id = {p["id"]: p for p in lst}
        assert by_id[c1["id"]]["cycle_length"] == 45  # c1 -> c2
        assert by_id[c2["id"]]["cycle_length"] == 15  # c2 -> c3
        assert by_id[c3["id"]]["cycle_length"] is None  # c3 是最后一条

    def test_patch_rejects_end_before_start(self, client, auth_user, make_auth_headers):
        headers = make_auth_headers(auth_user["token"])
        c1 = _add_period(client, headers, "2026-01-01")
        r = client.patch(
            f"/api/cycle/periods/{c1['id']}",
            json={"period_start": "2026-02-01T00:00:00", "period_end": "2026-01-15T00:00:00"},
            headers=headers,
        )
        assert r.status_code == 400

    def test_patch_duplicate_date_rejected(self, client, auth_user, make_auth_headers):
        headers = make_auth_headers(auth_user["token"])
        c1 = _add_period(client, headers, "2026-01-01")
        c2 = _add_period(client, headers, "2026-02-01")
        # 试图把 c2 改到 2026-01-01（与 c1 重复）
        r = client.patch(
            f"/api/cycle/periods/{c2['id']}",
            json={"period_start": "2026-01-01T00:00:00"},
            headers=headers,
        )
        assert r.status_code == 400
        assert "已有" in r.json()["detail"]

    def test_delete_period_recomputes_lengths(self, client, auth_user, make_auth_headers):
        headers = make_auth_headers(auth_user["token"])
        c1 = _add_period(client, headers, "2026-01-01")
        c2 = _add_period(client, headers, "2026-01-31")
        _add_period(client, headers, "2026-03-02")

        # 删 c2：c1 距 c3 应 = 60
        r = client.delete(f"/api/cycle/periods/{c2['id']}", headers=headers)
        assert r.status_code == 200
        assert r.json()["deleted_id"] == c2["id"]

        lst = client.get("/api/cycle/periods", headers=headers).json()["periods"]
        assert len(lst) == 2
        # c1 的 cycle_length 应 = 60（从 c1 2026-01-01 到 c3 2026-03-02）
        assert lst[0]["cycle_length"] == 60

    def test_patch_unknown_id_404(self, client, auth_user, make_auth_headers):
        headers = make_auth_headers(auth_user["token"])
        r = client.patch(
            "/api/cycle/periods/00000000-0000-0000-0000-000000000000",
            json={"period_start": "2026-01-01T00:00:00"},
            headers=headers,
        )
        assert r.status_code == 404

    def test_delete_unknown_id_404(self, client, auth_user, make_auth_headers):
        headers = make_auth_headers(auth_user["token"])
        r = client.delete(
            "/api/cycle/periods/00000000-0000-0000-0000-000000000000",
            headers=headers,
        )
        assert r.status_code == 404

    def test_cannot_modify_other_users_period(self, client, db_session, make_auth_headers, public_memory, auth_user):
        """跨用户隔离：A 改 B 的 cycle 应当 404"""
        # 给 auth_user 写一条经期
        from models import Cycle
        c = _add_period(
            client, make_auth_headers(auth_user["token"]), "2026-01-01"
        )
        # 直接用陌生 token 试改
        # 注册第二个用户
        r2 = client.post(
            "/api/auth/register",
            json={"email": "bob@example.com", "password": "secret123", "nickname": "Bob"},
        )
        assert r2.status_code == 200
        bob_token = r2.json()["token"]
        r = client.patch(
            f"/api/cycle/periods/{c['id']}",
            json={"period_start": "2026-02-01T00:00:00"},
            headers={"Authorization": f"Bearer {bob_token}"},
        )
        assert r.status_code == 404


# ===================================================================
# Resonance 频控
# ===================================================================
class TestRateLimit:
    def test_rate_limit_triggers_at_31st_in_hour(self, client, auth_user, make_auth_headers, public_memory):
        # 直接 unit-level：用 time-jittered bypass 不可行（DB now() 是真实的）
        # 改为：手工插入 30 条 ResponseModel，然后第 31 次创建应 429
        from models import Response as ResponseModel
        from datetime import datetime

        # 找 demo 公共 memory 的真实 id（用 list 拿）
        # public_memory fixture 来自 auth_user 自己，所以用 list_memories 拿
        lst = client.get(
            "/api/memories", headers=make_auth_headers(auth_user["token"])
        ).json()
        if not lst["memories"]:
            pytest.skip("no memory to react to")
        mem_id = lst["memories"][0]["id"]

        # 直接走 ORM 插 30 条（更稳，绕过 HTTP）
        from database import get_session
        from models import Memory
        for session in get_session():
            for _ in range(30):
                r = ResponseModel(
                    responder_id=auth_user["user_id"],
                    memory_id=mem_id,
                    response_type="empathy",
                )
                session.add(r)
            session.commit()
            break  # 只用第一个 session

        # 第 31 次：应被 429 拒
        r = client.post(
            f"/api/resonance/{mem_id}/responses",
            json={"response_type": "empathy"},
            headers=make_auth_headers(auth_user["token"]),
        )
        assert r.status_code == 429
        assert "频繁" in r.json()["detail"]

    def test_normal_response_under_limit_ok(self, client, auth_user, make_auth_headers, public_memory):
        mem_id = public_memory
        r = client.post(
            f"/api/resonance/{mem_id}/responses",
            json={"response_type": "empathy"},
            headers=make_auth_headers(auth_user["token"]),
        )
        assert r.status_code == 200
