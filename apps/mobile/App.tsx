import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';

const CODEFORGE_URL = 'https://codeforge-ide.vasudevaya.workers.dev/app';
const CODEFORGE_ORIGIN = 'https://codeforge-ide.vasudevaya.workers.dev';
const LOAD_TIMEOUT_MS = 30000;

function safePath(value: string): string {
  try {
    const url = new URL(value);
    return url.origin === CODEFORGE_ORIGIN ? url.pathname : '/external';
  } catch {
    return '/unknown';
  }
}

function logWebViewEvent(message: string): void {
  if (__DEV__) console.info('[CodeForgeWebView] ' + message);
}

const WEBVIEW_READY_SCRIPT = `
(function () {
  var origin = 'https://codeforge-ide.vasudevaya.workers.dev';
  var isCodeForgeAppRoute = window.location.origin === origin
    && (window.location.pathname === '/app' || window.location.pathname.indexOf('/app/') === 0);
  if (!isCodeForgeAppRoute) return true;

  if (window.__CODEFORGE_READY_WATCH_STARTED) return true;
  window.__CODEFORGE_READY_WATCH_STARTED = true;

  var startedAt = Date.now();
  var reported = {};
  var resourceErrors = 0;
  var promiseRejections = 0;

  function postNativeMessage(type, details) {
    if (reported[type]) return true;
    if (!window.ReactNativeWebView || typeof window.ReactNativeWebView.postMessage !== 'function') return false;
    reported[type] = true;
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: type,
      path: window.location.pathname,
      details: details || null
    }));
    return true;
  }

  window.addEventListener('error', function (event) {
    if (event && event.target && event.target !== window) resourceErrors += 1;
  }, true);
  window.addEventListener('unhandledrejection', function () {
    promiseRejections += 1;
  });

  function checkReady() {
    var readyMarker = document.querySelector('[data-codeforge-app-ready="true"]');
    var appRoot = document.querySelector('#root');
    var appHeading = document.querySelector('.auth-card h1');
    var headingText = appHeading ? (appHeading.textContent || '').trim() : '';
    var legacyAuthScreenRendered = /^(Welcome back\\.|Create your account\\.|Reset your password\\.|Choose a new password\\.|Connect Supabase Auth)$/.test(headingText);
    var previewBanner = document.querySelector('.browser-preview-banner');
    var legacyWorkspaceRendered = Boolean(previewBanner && (previewBanner.textContent || '').trim().length > 0);
    var appRendered = Boolean(readyMarker || legacyAuthScreenRendered || legacyWorkspaceRendered);

    if (document.readyState === 'complete' && appRendered) {
      return postNativeMessage('codeforge-ready', {
        readinessMarker: Boolean(readyMarker),
        authScreen: legacyAuthScreenRendered,
        workspaceShell: legacyWorkspaceRendered
      });
    }

    if (Date.now() - startedAt >= 20000) {
      postNativeMessage('codeforge-timeout', {
        readyState: document.readyState,
        rootChildren: appRoot ? appRoot.children.length : 0,
        authScreen: legacyAuthScreenRendered,
        workspaceShell: legacyWorkspaceRendered,
        resourceErrors: resourceErrors,
        promiseRejections: promiseRejections
      });
      return Boolean(reported['codeforge-timeout']);
    }

    return false;
  }

  function startReadinessWatch() {
    var observedRoot = document.documentElement || document;
    var observer = null;

    if (typeof MutationObserver === 'function') {
      observer = new MutationObserver(function () {
        if (checkReady() && observer) observer.disconnect();
      });
      observer.observe(observedRoot, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }

    function poll() {
      if (checkReady()) {
        if (observer) observer.disconnect();
        return;
      }
      window.setTimeout(poll, 250);
    }

    poll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startReadinessWatch, { once: true });
  } else {
    startReadinessWatch();
  }
  return true;
})();
true;
`;

function isCodeForgeAppUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.origin === CODEFORGE_ORIGIN
      && (url.pathname === '/app' || url.pathname.startsWith('/app/'));
  } catch {
    return false;
  }
}

export default function App() {
  const webView = useRef<WebView | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack && webView.current) {
        webView.current.goBack();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [canGoBack]);

  useEffect(() => {
    if (!loading || failed || ready) return undefined;
    const timeout = setTimeout(() => {
      setLoading(false);
      setFailed(true);
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timeout);
  }, [failed, loading, ready, reloadKey]);

  const retry = () => {
    setFailed(false);
    setReady(false);
    setLoading(true);
    setCanGoBack(false);
    setReloadKey(value => value + 1);
  };

  const openInBrowser = () => {
    void Linking.openURL(CODEFORGE_URL).catch(() => {
      setFailed(true);
    });
  };

  const failMainDocument = () => {
    setLoading(false);
    setReady(false);
    setFailed(true);
  };

  const handleMessage = (event: { nativeEvent: { data: string } }) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as {
        type?: string;
        path?: string;
        details?: {
          readyState?: string;
          rootChildren?: number;
          authScreen?: boolean;
          workspaceShell?: boolean;
          readinessMarker?: boolean;
          resourceErrors?: number;
          promiseRejections?: number;
        } | null;
      };
      const appPath = typeof message.path === 'string'
        && (message.path === '/app' || message.path.startsWith('/app/'))
        ? message.path
        : '/unknown';
      if (message.type === 'codeforge-ready' && appPath !== '/unknown') {
        logWebViewEvent('readiness=ready path=' + appPath);
        setReady(true);
        setLoading(false);
        setFailed(false);
      } else if (message.type === 'codeforge-timeout' && appPath !== '/unknown') {
        const details = message.details || {};
        logWebViewEvent(
          'readiness=timeout path=' + appPath
          + ' readyState=' + (details.readyState || 'unknown')
          + ' rootChildren=' + (Number.isInteger(details.rootChildren) ? details.rootChildren : -1)
          + ' authScreen=' + Boolean(details.authScreen)
          + ' workspaceShell=' + Boolean(details.workspaceShell)
          + ' resourceErrors=' + (Number.isInteger(details.resourceErrors) ? details.resourceErrors : -1)
          + ' promiseRejections=' + (Number.isInteger(details.promiseRejections) ? details.promiseRejections : -1)
        );
        failMainDocument();
      }
    } catch {
      // Ignore unrelated page messages; never log page content or URL query data.
    }
  };

  const handleNavigationStateChange = (state: { url: string; canGoBack: boolean }) => {
    setCanGoBack(state.canGoBack);
    if (state.url.startsWith('https://') && !isCodeForgeAppUrl(state.url)) {
      // OAuth providers and other HTTPS authentication pages remain usable in the WebView.
      setLoading(false);
      setReady(true);
      setFailed(false);
    }
  };

  return (
    <View style={styles.root}>
      <ExpoStatusBar style="light" backgroundColor="#080d13" />
      <WebView
        key={reloadKey}
        ref={webView}
        source={{ uri: CODEFORGE_URL }}
        style={styles.webview}
        accessible={true}
        accessibilityLabel={ready ? 'CodeForge app ready' : 'Loading CodeForge app'}
        originWhitelist={['https://*']}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        cacheEnabled
        pullToRefreshEnabled
        allowsBackForwardNavigationGestures
        allowFileAccess={false}
        allowUniversalAccessFromFileURLs={false}
        injectedJavaScript={WEBVIEW_READY_SCRIPT}
        onMessage={handleMessage}
        onNavigationStateChange={handleNavigationStateChange}
        onLoadStart={event => {
          logWebViewEvent('event=load-start path=' + safePath(event.nativeEvent.url));
          setLoading(true);
          setReady(false);
          setFailed(false);
        }}
        onLoadEnd={event => {
          logWebViewEvent('event=load-end path=' + safePath(event.nativeEvent.url));
          // Retry after the main document load so the native bridge and SPA root are both available.
          webView.current?.injectJavaScript(WEBVIEW_READY_SCRIPT);
        }}
        onError={event => {
          logWebViewEvent('event=load-error path=' + safePath(event.nativeEvent.url) + ' code=' + event.nativeEvent.code);
          failMainDocument();
        }}
        onHttpError={event => {
          const path = safePath(event.nativeEvent.url);
          logWebViewEvent('event=http-error path=' + path + ' status=' + event.nativeEvent.statusCode);
          if (isCodeForgeAppUrl(event.nativeEvent.url)) failMainDocument();
        }}
        onRenderProcessGone={() => {
          logWebViewEvent('event=renderer-gone path=/app');
          failMainDocument();
        }}
        onContentProcessDidTerminate={() => {
          logWebViewEvent('event=content-process-terminated path=/app');
          failMainDocument();
        }}
      />
      {loading && !failed && (
        <View pointerEvents="none" style={styles.loading}>
          <ActivityIndicator size="large" color="#9ef2bb" />
          <Text style={styles.muted}>Opening your CodeForge workspace…</Text>
        </View>
      )}
      {failed && (
        <View style={styles.error}>
          <Text style={styles.title}>CodeForge could not finish loading</Text>
          <Text style={styles.muted}>Check your connection, then retry or open the secure web version in your browser.</Text>
          <Pressable onPress={retry} style={styles.button}>
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
          <Pressable onPress={openInBrowser} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Open in browser</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080d13' },
  webview: { flex: 1, backgroundColor: '#080d13' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#080d13' },
  error: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28, backgroundColor: '#080d13' },
  title: { color: '#edf4f8', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  muted: { color: '#93a3b5', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  button: { marginTop: 8, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 8, backgroundColor: '#d9f9e4' },
  buttonText: { color: '#0b2116', fontWeight: '700' },
  secondaryButton: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: '#425263' },
  secondaryButtonText: { color: '#edf4f8', fontWeight: '600' },
});
