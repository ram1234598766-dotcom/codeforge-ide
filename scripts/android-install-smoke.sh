#!/usr/bin/env bash
set -euo pipefail

APK_PATH="${1:-release/CodeForge-debug.apk}"
PACKAGE_NAME="${2:-com.codeforge.ide}"
LOG_FILE="$(mktemp)"

cleanup() {
  adb uninstall "$PACKAGE_NAME" >/dev/null 2>&1 || true
  rm -f "$LOG_FILE"
}
trap cleanup EXIT

if [[ ! -s "$APK_PATH" ]]; then
  printf 'APK not found or empty: %s\n' "$APK_PATH" >&2
  exit 1
fi

adb wait-for-device
adb install -r "$APK_PATH"
adb shell monkey -p "$PACKAGE_NAME" 1

APP_PID=""
for attempt in $(seq 1 30); do
  APP_PID="$(adb shell pidof "$PACKAGE_NAME" | tr -d '\r' || true)"
  if [[ -n "$APP_PID" ]]; then
    break
  fi
  sleep 1
done

if [[ -z "$APP_PID" ]]; then
  adb logcat -d -s AndroidRuntime:E >&2 || true
  printf 'Android app process did not start: %s\n' "$PACKAGE_NAME" >&2
  exit 1
fi

sleep 5
APP_PID="$(adb shell pidof "$PACKAGE_NAME" | tr -d '\r' || true)"
if [[ -z "$APP_PID" ]]; then
  adb logcat -d -s AndroidRuntime:E >&2 || true
  printf 'Android app process exited after launch: %s\n' "$PACKAGE_NAME" >&2
  exit 1
fi

adb logcat -d -s AndroidRuntime:E > "$LOG_FILE"
if grep -q "FATAL EXCEPTION" "$LOG_FILE"; then
  cat "$LOG_FILE" >&2
  exit 1
fi

adb uninstall "$PACKAGE_NAME"
if adb shell pm list packages | grep -Fqx "package:$PACKAGE_NAME"; then
  printf 'Android package remained installed after cleanup: %s\n' "$PACKAGE_NAME" >&2
  exit 1
fi

printf 'Android install, launch, process stability, crash-log, and uninstall smoke passed.\n'
