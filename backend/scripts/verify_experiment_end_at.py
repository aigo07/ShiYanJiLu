from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request


def http_json(method: str, url: str, payload: dict | None = None) -> tuple[int, dict]:
    data = None
    headers = {}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        raise RuntimeError(f"HTTP {e.code}: {body}") from None


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8013"
    _, exps = http_json("GET", f"{base}/experiments?limit=10&offset=0")
    if not exps:
        print("no experiments")
        return 1

    eid = exps[0]["id"]
    _, ended = http_json("PATCH", f"{base}/experiments/{eid}", {"status": "已结束"})
    ended_ok = ended.get("status") == "已结束" and ended.get("end_at") is not None

    _, active = http_json("PATCH", f"{base}/experiments/{eid}", {"status": "进行中"})
    active_ok = active.get("status") == "进行中" and active.get("end_at") is None

    print(f"eid={eid} ended_ok={ended_ok} active_ok={active_ok}")
    return 0 if (ended_ok and active_ok) else 2


if __name__ == "__main__":
    raise SystemExit(main())

