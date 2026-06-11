from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request


def main() -> int:
    base = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8014"
    url = f"{base}/curing-agents/1"
    payload = {
        "default_ratio": 1,
        "status": None,
        "note": None,
        "composition": [{"material_id": 20, "mass_pct": 100.0}],
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="PATCH",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            print(r.status)
            print(r.read().decode("utf-8"))
            return 0
    except urllib.error.HTTPError as e:
        print("HTTP", e.code)
        print(e.read().decode("utf-8"))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

