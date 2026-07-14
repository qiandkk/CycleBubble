#!/usr/bin/env python3
"""
CycleBubble GitHub Webhook receiver.

Listens on 0.0.0.0:9001 (or $PORT), validates GitHub HMAC-SHA256 signature,
runs update.sh on push events to the configured branch.

Setup:
  1. Save the shared secret to /etc/cyclebubble-webhook-secret (chmod 600)
  2. Register webhook in GitHub repo Settings → Webhooks:
       Payload URL: http://YOUR_SERVER:9000/webhook
       Content type: application/json
       Secret: <must match /etc/cyclebubble-webhook-secret>
       Events: Just the push event
"""
import hashlib
import hmac
import json
import os
import subprocess
import sys
import threading
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer

SECRET_FILE = "/etc/cyclebubble-webhook-secret"
APP_DIR = "/var/www/app"
UPDATE_SCRIPT = "/usr/local/bin/cyclebubble-update.sh"
LOG_FILE = "/var/log/app/webhook.log"
WATCHED_BRANCH = "master"


def log(msg: str) -> None:
    line = f"[{datetime.now().isoformat()}] {msg}\n"
    with open(LOG_FILE, "a") as f:
        f.write(line)
    sys.stderr.write(line)
    sys.stderr.flush()


def load_secret() -> str:
    try:
        with open(SECRET_FILE) as f:
            return f.read().strip()
    except Exception as e:
        log(f"FATAL: cannot read {SECRET_FILE}: {e}")
        sys.exit(1)


SECRET = load_secret()


def verify_signature(payload: bytes, signature_header: str) -> bool:
    """GitHub sends X-Hub-Signature-256: sha256=<hex>"""
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(
        SECRET.encode("utf-8"), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature_header)


def run_update(branch: str) -> None:
    log(f"triggering update for branch={branch}")
    try:
        result = subprocess.run(
            ["bash", UPDATE_SCRIPT, branch],
            capture_output=True, text=True, timeout=300,
        )
        log(f"update exit={result.returncode}")
        if result.stdout:
            log(f"stdout:\n{result.stdout}")
        if result.stderr:
            log(f"stderr:\n{result.stderr}")
    except Exception as e:
        log(f"update exception: {e}")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def do_POST(self):
        if self.path != "/webhook":
            self.send_error(404)
            return

        length = int(self.headers.get("Content-Length", 0))
        payload = self.rfile.read(length)
        sig = self.headers.get("X-Hub-Signature-256", "")
        event = self.headers.get("X-GitHub-Event", "")

        if event != "push":
            self._reply(200, {"ignored": f"event={event}"})
            return

        if not verify_signature(payload, sig):
            log(f"signature mismatch from {self.client_address[0]}")
            self._reply(401, {"error": "invalid signature"})
            return

        try:
            data = json.loads(payload)
        except Exception:
            self._reply(400, {"error": "invalid json"})
            return

        ref = data.get("ref", "")
        branch = ref.split("/")[-1] if ref else ""
        if branch != WATCHED_BRANCH:
            self._reply(200, {"ignored": f"branch={branch}"})
            return

        threading.Thread(target=run_update, args=(branch,), daemon=True).start()
        self._reply(202, {"status": "updating", "branch": branch})

    def do_GET(self):
        if self.path == "/health":
            self._reply(200, {"status": "ok"})
        else:
            self.send_error(404)

    def _reply(self, code: int, obj: dict) -> None:
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 9001))
    log(f"webhook listener starting on 0.0.0.0:{port}")
    HTTPServer(("0.0.0.0", port), Handler).serve_forever()