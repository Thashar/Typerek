import sys
import os
import json
import traceback

_boot_error = None
_app = None

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

try:
    from main import app as _app
except Exception:
    _boot_error = traceback.format_exc()


async def app(scope, receive, send):
    if scope["type"] != "http":
        return

    if _boot_error:
        body = json.dumps({"boot_error": _boot_error, "python": sys.version, "path": sys.path}).encode()
        await send({"type": "http.response.start", "status": 200, "headers": [
            [b"content-type", b"application/json"],
        ]})
        await send({"type": "http.response.body", "body": body})
        return

    await _app(scope, receive, send)
