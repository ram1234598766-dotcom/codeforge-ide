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

const WEBVIEW_READY_SCRIPT = `
(function () {
  var origin = 'https://codeforge-ide.vasudevaya.workers.dev';
  var isCodeForgeAppRoute = window.location.origin === origin
    && (window.location.pathname === '/app' || window.location.pathname.indexOf('/app/') === 0);
  if (!isCodeForgeAppRoute) return true;

  var startedAt = Date.now();
  var timeoutReported = false;

  function postNativeMessage(type) {
    if (type === 'codeforge-ready') {
      if (window.__CODEFORGE_APP_READY_REPORTED) return true;
      if (!window.ReactNativeWebView || typeof window.ReactNativeWebView.postMessage !== 'function') return false;
      window.__CODEFORGE_APP_READY_REPORTED = true;
    } else {
      if (timeoutReported || !window.ReactNativeWebView || typeof window.ReactNativeWebView.postMessage !== 'function') return false;
      timeoutReported = true;
    }

    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: type,
      path: window.location.pathname
    }));
    return true;
  }

  function checkReady() {
    var readyMarker = document.querySelector('[data-codeforge-app-ready="true"]');
    var appRoot = document.querySelector('#root');
    var appRendered = Boolean(readyMarker || (appRoot && appRoot.children.length > 0));

    if (document.readyState === 'complete' && appRendered) {
      return postNativeMessage('codeforge-ready');
    }

    if (Date.now() - startedAt >= 20000) {
      postNativeMessage('codeforge-timeout');
      return timeoutReported;
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
      const message = JSON.parse(event.nativeEvent.data) as { type?: string; path?: string };
      if (message.type === 'codeforge-ready' && typeof message.path === 'string'
        && (message.path === '/app' || message.path.startsWith('/app/'))) {
        setReady(true);
        setLoading(false);
        setFailed(false);
      } else if (message.type === 'codeforge-timeout') {
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
        onLoadStart={() => {
          setLoading(true);
          setReady(false);
          setFailed(false);
        }}
        onLoadEnd={() => {
          // Retry after the main document load so the native bridge and SPA root are both available.
          webView.current?.injectJavaScript(WEBVIEW_READY_SCRIPT);
        }}
        onError={failMainDocument}
        onHttpError={event => {
          if (isCodeForgeAppUrl(event.nativeEvent.url)) failMainDocument();
        }}
        onRenderProcessGone={failMainDocument}
        onContentProcessDidTerminate={failMainDocument}
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
