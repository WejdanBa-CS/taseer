#!/usr/bin/env bash
# نقطة دخول harness تسعير: all | unit | security | smoke
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LAYER="${1:-all}"
shift || true
REQUIRE_LIVE=0
for arg in "$@"; do
  if [[ "$arg" == "--require-live" ]]; then
    REQUIRE_LIVE=1
  fi
done

FAIL=0

run_unit() {
  echo "==> unit (flutter test)"
  if ! command -v flutter >/dev/null 2>&1; then
    if [[ -x "$HOME/flutter/bin/flutter" ]]; then
      export PATH="$HOME/flutter/bin:$PATH"
    else
      echo "FAIL: flutter not found in PATH"
      return 1
    fi
  fi
  (cd "$ROOT/mobile" && flutter test)
}

run_security() {
  echo "==> security"
  python3 "$ROOT/harness/security_check.py" "$ROOT"
}

run_smoke() {
  echo "==> smoke"
  local args=("$ROOT")
  if [[ "$REQUIRE_LIVE" -eq 1 ]]; then
    args+=(--require-live)
  fi
  python3 "$ROOT/harness/smoke_api.py" "${args[@]}"
}

case "$LAYER" in
  all)
    run_unit || FAIL=1
    run_security || FAIL=1
    run_smoke || FAIL=1
    ;;
  unit)
    run_unit || FAIL=1
    ;;
  security)
    run_security || FAIL=1
    ;;
  smoke)
    run_smoke || FAIL=1
    ;;
  *)
    echo "Usage: $0 {all|unit|security|smoke} [--require-live]"
    exit 2
    ;;
esac

if [[ "$FAIL" -ne 0 ]]; then
  echo "harness: FAILED"
  exit 1
fi
echo "harness: OK ($LAYER)"
