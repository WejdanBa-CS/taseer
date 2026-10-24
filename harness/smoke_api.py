#!/usr/bin/env python3
"""Smoke: health + crowd GET إن وُجد خادم؛ وإلا SKIP."""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


def candidate_roots() -> list[str]:
    roots: list[str] = []
    env = (os.environ.get("TASEER_CROWD_ENDPOINT") or "").strip().rstrip("/")
    if env:
        roots.append(env)
    roots.extend(
        [
            "http://127.0.0.1:8771",
            "http://127.0.0.1:8765",
        ]
    )
    # إزالة تكرار مع الحفاظ على الترتيب
    seen: set[str] = set()
    out: list[str] = []
    for item in roots:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def uses_functions_v1(root: str) -> bool:
    return "/functions/v1" in root


def health_url(root: str) -> str:
    if uses_functions_v1(root):
        return f"{root}/health"
    return f"{root}/health"


def crowd_url(root: str) -> str:
    if uses_functions_v1(root):
        return f"{root}/crowd"
    return f"{root}/api/crowd"


def http_get(url: str, timeout: float = 4.0) -> tuple[int, bytes]:
    req = urllib.request.Request(url, method="GET")
    anon = (os.environ.get("TASEER_SUPABASE_ANON_KEY") or "").strip()
    if anon and "/functions/v1" in url:
        req.add_header("apikey", anon)
        req.add_header("Authorization", f"Bearer {anon}")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read()


def try_root(root: str) -> bool:
    try:
        status, body = http_get(health_url(root))
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        print(f"[SKIP] health unreachable at {root}: {exc}")
        return False
    if status != 200:
        print(f"[FAIL] health {root} -> HTTP {status}")
        return False
    print(f"[PASS] health {root} -> 200")

    query = urllib.parse.urlencode(
        {
            "brand": "kia",
            "model": "SPORTAGE",
            "yearLabel": "2024",
            "part": "front-pads",
            "city": "الرياض",
        }
    )
    url = f"{crowd_url(root)}?{query}"
    try:
        status, body = http_get(url)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        print(f"[FAIL] crowd GET {root}: {exc}")
        return False
    if status != 200:
        print(f"[FAIL] crowd GET -> HTTP {status}")
        return False
    try:
        data = json.loads(body.decode("utf-8"))
    except json.JSONDecodeError:
        print("[FAIL] crowd GET: body is not JSON")
        return False
    if data.get("ok") is False:
        print(f"[FAIL] crowd GET: ok=false payload={data!r}")
        return False
    print(f"[PASS] crowd GET {root} -> JSON ok")
    return True


def main() -> int:
    _root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(".").resolve()
    require_live = "--require-live" in sys.argv[2:]

    for root in candidate_roots():
        if try_root(root):
            print("smoke_api: OK")
            return 0

    if require_live:
        print("smoke_api: FAILED (no live server, --require-live set)")
        return 1
    print("smoke_api: SKIP (no live crowd server)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
