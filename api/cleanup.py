from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

from http.server import BaseHTTPRequestHandler

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from cpa_codex_cleanup_engine import execute_cleanup  # noqa: E402


def _json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Cache-Control", "no-store")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            size = int(self.headers.get("Content-Length", "0") or "0")
            raw = self.rfile.read(size) if size > 0 else b"{}"
            payload = json.loads(raw.decode("utf-8"))
            if not isinstance(payload, dict):
                raise ValueError("JSON body must be an object")
        except Exception as exc:
            _json_response(self, 400, {"ok": False, "error": f"invalid json: {exc}"})
            return

        logs: list[str] = []

        def add_log(line: str) -> None:
            logs.append(line)
            if len(logs) > 5000:
                del logs[:-5000]

        try:
            summary = execute_cleanup(payload, log=add_log)
            _json_response(self, 200, {"ok": True, "status": "completed", "summary": summary, "logs": "\n".join(logs)})
        except Exception as exc:
            _json_response(self, 500, {"ok": False, "status": "failed", "error": str(exc), "logs": "\n".join(logs)})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
