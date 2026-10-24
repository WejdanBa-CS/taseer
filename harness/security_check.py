#!/usr/bin/env python3
"""فحوصات أمان ثابتة على مستودع تسعير (بدون استغلال)."""

from __future__ import annotations

import re
import sys
from pathlib import Path

SKIP_DIRS = {
    ".git",
    "build",
    ".dart_tool",
    "Pods",
    "node_modules",
    ".idea",
    "DerivedData",
}


def rel(root: Path, path: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)


def iter_source_files(root: Path):
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.suffix.lower() not in {
            ".dart",
            ".ts",
            ".js",
            ".py",
            ".sql",
            ".json",
            ".yml",
            ".yaml",
            ".plist",
            ".env",
            ".md",
            ".sh",
        }:
            continue
        yield path


def check(name: str, ok: bool, detail: str, failures: list[str]) -> None:
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] {name}: {detail}")
    if not ok:
        failures.append(name)


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    failures: list[str] = []

    # 1) لا ترفع ملفات .env
    env_files = [
        p
        for p in root.rglob("*")
        if p.is_file()
        and p.name.startswith(".env")
        and ".git" not in p.parts
        and p.name != ".env.example"
    ]
    check(
        "no-committed-env",
        len(env_files) == 0,
        "none" if not env_files else ", ".join(rel(root, p) for p in env_files[:5]),
        failures,
    )

    # 2) لا يظهر service_role في كود العميل
    service_hits: list[str] = []
    service_re = re.compile(r"service[_-]?role", re.I)
    client_roots = [root / "mobile" / "lib", root / "js", root / "mobile" / "assets"]
    for base in client_roots:
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if not path.is_file() or path.suffix not in {".dart", ".js", ".ts", ".json"}:
                continue
            try:
                text = path.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
            if service_re.search(text):
                service_hits.append(rel(root, path))
    check(
        "no-service-role-in-client",
        len(service_hits) == 0,
        "ok" if not service_hits else ", ".join(service_hits[:5]),
        failures,
    )

    # 3) api.dart يقيّد HTTP للمحلي
    api_path = root / "mobile" / "lib" / "services" / "api.dart"
    api_text = api_path.read_text(encoding="utf-8") if api_path.exists() else ""
    has_allow = "_endpointAllowed" in api_text and "https" in api_text
    has_local = "_isLocalHost" in api_text or "127.0.0.1" in api_text
    check(
        "api-endpoint-https-or-localhost",
        has_allow and has_local,
        "api.dart enforces HTTPS / localhost HTTP",
        failures,
    )

    # 4) Edge: CORS + rate limit في المشترك
    shared = root / "supabase" / "functions" / "_shared" / "crowd.ts"
    shared_text = shared.read_text(encoding="utf-8") if shared.exists() else ""
    check(
        "edge-cors-and-rate-limit",
        "corsHeaders" in shared_text
        and "allowRequest" in shared_text
        and "RATE_LIMIT" in shared_text,
        rel(root, shared) if shared.exists() else "missing _shared/crowd.ts",
        failures,
    )

    # 5) الميجريشن تسحب صلاحيات anon عن الجداول الحساسة
    migrations = list((root / "supabase" / "migrations").glob("*.sql")) if (
        root / "supabase" / "migrations"
    ).exists() else []
    revoke_ok = False
    for mig in migrations:
        text = mig.read_text(encoding="utf-8", errors="ignore")
        if "revoke all" in text.lower() and "anon" in text.lower():
            revoke_ok = True
            break
    check(
        "migration-revoke-anon",
        revoke_ok or not migrations,
        "found revoke for anon" if revoke_ok else ("no migrations" if not migrations else "missing revoke"),
        failures,
    )

    # 6) مفتاح anon عبر fromEnvironment فقط (مسموح كافتراضي عام، ممنوع service)
    config_path = root / "mobile" / "lib" / "services" / "config.dart"
    config_text = config_path.read_text(encoding="utf-8") if config_path.exists() else ""
    anon_via_env = "String.fromEnvironment" in config_text and "TASEER_SUPABASE_ANON_KEY" in config_text
    no_service_in_config = "service_role" not in config_text.lower()
    check(
        "anon-key-via-fromEnvironment",
        anon_via_env and no_service_in_config,
        "config.dart uses dart-define for anon key",
        failures,
    )

    # 7) تحذير معلوماتي: JWT anon مضمّن كافتراضي (متوقع للمفتاح العام)
    has_embedded_jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" in config_text
    print(
        f"[INFO] embedded-anon-default: "
        f"{'present (public anon default)' if has_embedded_jwt else 'absent'}"
    )

    if failures:
        print(f"security_check: FAILED ({len(failures)})")
        return 1
    print("security_check: OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
