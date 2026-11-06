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

WEBVIEW_READY=false
WEBVIEW_READY_REASON=""
for attempt in $(seq 1 60); do
  adb shell uiautomator dump /sdcard/codeforge-window.xml >/dev/null 2>&1 || true
  UI_TREE="$(adb shell cat /sdcard/codeforge-window.xml 2>/dev/null | tr -d '\\r' || true)"

  # Prefer the native readiness signal, but independently confirm rendered website content.
  # UIAutomator may expose WebView DOM text without exposing the WebView accessibilityLabel.
  for marker in \
    "CodeForge app ready" \
    "Welcome back." \
    "Sign in securely to access your projects and saved files." \
    "Create your account." \
    "Connect Supabase Auth" \
    "CODEFORGE WEB PREVIEW" \
    "AI COMMAND CENTER"; do
    if [[ "$UI_TREE" == *"$marker"* ]]; then
      WEBVIEW_READY=true
      WEBVIEW_READY_REASON="$marker"
      break
    fi
  done

  if [[ "$WEBVIEW_READY" == "true" ]]; then
    break
  fi
  sleep 1
done

if [[ "$WEBVIEW_READY" != "true" ]]; then
  adb logcat -d -s AndroidRuntime:E chromium:E WebViewFactory:I > "$LOG_FILE" || true
  echo "::group::CODEFORGE_MOBILE_UI_DIAGNOSTICS"
  echo "No verified native WebView readiness or hosted CodeForge content was found."
  echo "Relevant visible accessibility text:"
  printf '%s\\n' "$UI_TREE" | grep -Eo '(text|content-desc)="[^"]{1,160}"' | grep -E -i 'CodeForge|Welcome|Sign in|Supabase|Loading|workspace|error|retry' | head -n 40 || true
  echo "Resumed Android activity:"
  adb shell dumpsys activity activities 2>/dev/null | grep -E 'mResumedActivity|ResumedActivity' | tail -n 3 || true
  echo "Relevant WebView/runtime log messages:"
  grep -E -i "WebView|chromium|CodeForge|net::ERR|failed to load" "$LOG_FILE" | tail -n 40 || true
  echo "::endgroup::"
  printf 'Hosted CodeForge /app route did not render recognizable app content in the WebView.\\n' >&2
  exit 1
fi

printf 'Hosted CodeForge /app rendered successfully in Android WebView. Readiness evidence: %s\\n' "$WEBVIEW_READY_REASON"

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
