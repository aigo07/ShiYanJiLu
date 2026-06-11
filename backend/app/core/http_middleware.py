from __future__ import annotations

import time
import uuid

from fastapi import Request, Response

from app.core.logging import get_logger
from app.core.request_context import set_request_id


log = get_logger("http")


async def request_context_middleware(request: Request, call_next):
    rid = request.headers.get("X-Request-Id") or str(uuid.uuid4())
    set_request_id(rid)

    start = time.perf_counter()
    status_code = 500
    try:
        response: Response = await call_next(request)
        status_code = response.status_code
        response.headers["X-Request-Id"] = rid
        return response
    finally:
        latency_ms = int((time.perf_counter() - start) * 1000)
        log.info(
            "request",
            extra={
                "props": {
                    "method": request.method,
                    "path": request.url.path,
                    "query": request.url.query,
                    "status_code": status_code,
                    "latency_ms": latency_ms,
                    "client_ip": request.client.host if request.client else None,
                }
            },
        )

