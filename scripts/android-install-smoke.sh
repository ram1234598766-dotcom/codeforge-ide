#!/usr/bin/env bash
set -euo pipefail

APK_PATH="${1:-release/CodeForge-debug.apk}"
PACKAGE_NAME="${2:-com.codeforge.ide}"
DIAGNOSTICS_DIR="${CODEFORGE_DIAGNOSTICS_DIR:-release/mobile-smoke-diagnostics}"
LOG_FILE="$(mktemp)"
UI_TREE=""
WEBVIEW_READY=false
WEBVIEW_READY_REASON=""
NATIVE_BRIDGE_READY=false
AUTH_SCREEN_RENDERED=false
WORKSPACE_SHELL_RENDERED=false
READY_LABEL_VISIBLE=false
VISIBLE_APP_TEXT=false

write_readiness_evidence() {
  {
    printf 'NATIVE_BRIDGE_READY=%s\n' "$NATIVE_BRIDGE_READY"
    printf 'AUTH_SCREEN_RENDERED=%s\n' "$AUTH_SCREEN_RENDERED"
    printf 'WORKSPACE_SHELL_RENDERED=%s\n' "$WORKSPACE_SHELL_RENDERED"
    printf 'ACCESSIBILITY_READY_LABEL=%s\n' "$READY_LABEL_VISIBLE"
    printf 'VISIBLE_APP_TEXT=%s\n' "$VISIBLE_APP_TEXT"
  } > "$DIAGNOSTICS_DIR/readiness.txt"
}

mkdir -p "$DIAGNOSTICS_DIR"

cleanup() {
  adb uninstall "$PACKAGE_NAME" >/dev/null 2>&1 || true
  rm -f "$LOG_FILE"
}
trap cleanup EXIT

capture_diagnostics() {
  mkdir -p "$DIAGNOSTICS_DIR"
  write_readiness_evidence
  adb shell uiautomator dump /sdcard/codeforge-window.xml >/dev/null 2>&1 || true
  adb pull /sdcard/codeforge-window.xml "$DIAGNOSTICS_DIR/window.xml" >/dev/null 2>&1 || true
  adb shell screencap -p /sdcard/codeforge-screen.png >/dev/null 2>&1 || true
  adb pull /sdcard/codeforge-screen.png "$DIAGNOSTICS_DIR/screen.png" >/dev/null 2>&1 || true
  adb logcat -d -s ReactNativeJS:V ReactNative:V AndroidRuntime:E chromium:E WebViewFactory:I > "$LOG_FILE" || true
  grep -F '[CodeForgeWebView]' "$LOG_FILE" > "$DIAGNOSTICS_DIR/webview.log" || true
  grep -Ei 'Unable to load script|index\.android\.bundle|loadJSBundleFromAssets|loadScriptFromAssets|FileNotFoundException|AssetManager|JSBundleLoader|Hermes|FATAL EXCEPTION|Caused by:' "$LOG_FILE" \
    | sed -E 's#(https?://[^?[:space:]]+)\?[^[:space:]]+#\1?[REDACTED]#g; s#(Bearer )[[:alnum:]_./+-]+#\1[REDACTED]#g' \
    > "$DIAGNOSTICS_DIR/native-startup.log" || true
  if [[ -s "$DIAGNOSTICS_DIR/window.xml" ]]; then
    grep -Eo '(text|content-desc)="[^"]{1,160}"' "$DIAGNOSTICS_DIR/window.xml" > "$DIAGNOSTICS_DIR/accessibility.txt" || true
  fi
  {
    printf 'SDK='
    adb shell getprop ro.build.version.sdk | tr -d '\r'
    printf 'WEBVIEW='
    adb shell dumpsys webviewupdate 2>/dev/null | grep -E 'Current WebView package|Version' | head -n 2 | tr -d '\r' || true
  } > "$DIAGNOSTICS_DIR/device.txt"
}

enable_emulator_network() {
  adb shell settings put global airplane_mode_on 0 >/dev/null 2>&1 || true
  adb shell svc wifi enable >/dev/null 2>&1 || true
  adb shell svc data enable >/dev/null 2>&1 || true
  adb shell am broadcast -a android.intent.action.AIRPLANE_MODE --ez state false >/dev/null 2>&1 || true

  for attempt in $(seq 1 30); do
    if adb shell dumpsys connectivity 2>/dev/null | grep -Eq 'INTERNET.*VALIDATED|VALIDATED.*INTERNET'; then
      printf 'VALIDATED_NETWORK=true\n' > "$DIAGNOSTICS_DIR/network.txt"
      return 0
    fi
    sleep 2
  done

  {
    printf 'AIRPLANE_MODE='
    adb shell settings get global airplane_mode_on | tr -d '\r'
    printf 'WIFI_ENABLED='
    adb shell settings get global wifi_on | tr -d '\r'
    printf 'VALIDATED_NETWORK=false\n'
  } > "$DIAGNOSTICS_DIR/network.txt"
  echo "::error::Android emulator has no validated internet network. Hosted WebView verification is NOT VERIFIED; this is an emulator/network prerequisite."
  return 1
}

if [[ ! -s "$APK_PATH" ]]; then
  printf 'APK not found or empty: %s\n' "$APK_PATH" >&2
  exit 1
fi

adb wait-for-device
if ! enable_emulator_network; then
  capture_diagnostics
  cat "$DIAGNOSTICS_DIR/network.txt" >&2
  exit 2
fi
adb logcat -c
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

for attempt in $(seq 1 60); do
  adb shell uiautomator dump /sdcard/codeforge-window.xml >/dev/null 2>&1 || true
  UI_TREE="$(adb shell cat /sdcard/codeforge-window.xml 2>/dev/null | tr -d '\r' || true)"

  BRIDGE_READY="$(adb logcat -d -s ReactNativeJS:V | grep -F '[CodeForgeWebView] readiness=ready path=/app' | tail -n 1 || true)"
  if [[ -n "$BRIDGE_READY" ]] && grep -Eq 'authScreen=true|workspaceShell=true' <<< "$BRIDGE_READY"; then
    NATIVE_BRIDGE_READY=true
    if grep -Fq 'authScreen=true' <<< "$BRIDGE_READY"; then AUTH_SCREEN_RENDERED=true; fi
    if grep -Fq 'workspaceShell=true' <<< "$BRIDGE_READY"; then WORKSPACE_SHELL_RENDERED=true; fi
  fi

  if [[ "$UI_TREE" == *"CodeForge app ready"* ]]; then
    READY_LABEL_VISIBLE=true
  fi

  # Collect only a boolean: never persist page text, account data, or auth state.
  for marker in \
    "Welcome back." \
    "Sign in securely to access your projects and saved files." \
    "Create your account." \
    "Reset your password." \
    "Choose a new password." \
    "CODEFORGE WEB PREVIEW" \
    "AI COMMAND CENTER"; do
    if [[ "$UI_TREE" == *"$marker"* ]]; then
      VISIBLE_APP_TEXT=true
      break
    fi
  done

  if [[ "$NATIVE_BRIDGE_READY" == "true" && "$READY_LABEL_VISIBLE" == "true" ]]; then
    WEBVIEW_READY=true
    WEBVIEW_READY_REASON="native bridge confirmed rendered auth/workspace DOM and accessibility readiness label"
    write_readiness_evidence
    break
  fi

  TIMEOUT_DIAGNOSTIC="$(adb logcat -d -s ReactNativeJS:V | grep -F '[CodeForgeWebView] readiness=timeout path=/app' | tail -n 1 || true)"
  if [[ -n "$TIMEOUT_DIAGNOSTIC" ]]; then
    break
  fi
  sleep 1
done
write_readiness_evidence

if [[ "$WEBVIEW_READY" != "true" ]]; then
  capture_diagnostics
  echo "::group::CODEFORGE_MOBILE_UI_DIAGNOSTICS"
  echo "No verified native WebView readiness or hosted CodeForge content was found."
  echo "Sanitized WebView lifecycle diagnostics:"
  cat "$DIAGNOSTICS_DIR/webview.log" 2>/dev/null || true
  echo "Filtered native bundle-load diagnostics:"
  cat "$DIAGNOSTICS_DIR/native-startup.log" 2>/dev/null || true
  echo "Relevant visible accessibility text:"
  cat "$DIAGNOSTICS_DIR/accessibility.txt" 2>/dev/null || true
  echo "Resumed Android activity:"
  adb shell dumpsys activity activities 2>/dev/null | grep -E 'mResumedActivity|ResumedActivity' | tail -n 3 || true
  echo "Device/WebView metadata:"
  cat "$DIAGNOSTICS_DIR/device.txt" 2>/dev/null || true
  echo "Screenshot and UI hierarchy are retained in the CI diagnostic artifact."
  echo "::endgroup::"
  printf 'Hosted CodeForge /app did not render recognizable application content in the WebView.\n' >&2
  exit 1
fi

printf 'Hosted CodeForge /app rendered successfully in Android WebView: %s\n' "$WEBVIEW_READY_REASON"

sleep 5
APP_PID="$(adb shell pidof "$PACKAGE_NAME" | tr -d '\r' || true)"
if [[ -z "$APP_PID" ]]; then
  capture_diagnostics
  printf 'Android app process exited after WebView readiness: %s\n' "$PACKAGE_NAME" >&2
  exit 1
fi

adb logcat -d -s AndroidRuntime:E > "$LOG_FILE"
if grep -q "FATAL EXCEPTION" "$LOG_FILE"; then
  cat "$LOG_FILE" >&2
  capture_diagnostics
  exit 1
fi

adb uninstall "$PACKAGE_NAME"
if adb shell pm list packages | grep -Fqx "package:$PACKAGE_NAME"; then
  printf 'Android package remained installed after cleanup: %s\n' "$PACKAGE_NAME" >&2
  exit 1
fi

printf 'Android install, rendered WebView readiness, process stability, crash-log, and uninstall smoke passed.\n'
