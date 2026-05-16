import sys
import os
import traceback

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

try:
    from main import app
except Exception as _e:
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware

    app = FastAPI()
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
    _err = traceback.format_exc()

    @app.get("/api/health")
    def health():
        return {"status": "boot_error", "detail": str(_e), "trace": _err}

    @app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
    def fallback(path: str):
        return {"status": "boot_error", "detail": str(_e)}
