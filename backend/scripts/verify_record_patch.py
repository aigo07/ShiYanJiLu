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
    status, exps = http_json("GET", f"{base}/experiments?limit=10&offset=0")
    assert status == 200
    if not exps:
        print("no experiments")
        return 1

    exp_id = exps[0]["id"]
    _, exp = http_json("GET", f"{base}/experiments/{exp_id}?include_records=true")
    records = exp.get("records") or []
    if not records:
        print(f"experiment {exp_id} has no records")
        return 1

    rid = records[0]["id"]
    new_note = "draft-verify"
    http_json("PATCH", f"{base}/records/{rid}", {"note": new_note})
    _, rec = http_json("GET", f"{base}/records/{rid}")
    ok = rec.get("note") == new_note
    print(f"record_id={rid} patched_note_ok={ok}")
    return 0 if ok else 2


if __name__ == "__main__":
    raise SystemExit(main())

