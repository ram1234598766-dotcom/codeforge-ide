import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { WebView } from 'react-native-webview';

const CODEFORGE_URL = 'https://codeforge-ide.vasudevaya.workers.dev';

export default function App() {
  const webView = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (webView.current) {
        webView.current.goBack();
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, []);

  const retry = () => {
    setFailed(false);
    setLoading(true);
    setReloadKey(value => value + 1);
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#080d13" />
      <ExpoStatusBar style="light" />
      <WebView
        key={reloadKey}
        ref={webView}
        source={{ uri: CODEFORGE_URL }}
        style={styles.webview}
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
        startInLoadingState
        onLoadStart={() => { setLoading(true); setFailed(false); }}
        onLoadEnd={() => setLoading(false)}
        onError={() => { setLoading(false); setFailed(true); }}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#9ef2bb" />
            <Text style={styles.muted}>Loading CodeForge…</Text>
          </View>
        )}
      />
      {loading && (
        <View pointerEvents="none" style={styles.progress}>
          <ActivityIndicator size="small" color="#9ef2bb" />
        </View>
      )}
      {failed && (
        <View style={styles.error}>
          <Text style={styles.title}>Unable to reach CodeForge</Text>
          <Text style={styles.muted}>Check your connection and try again.</Text>
          <Pressable onPress={retry} style={styles.button}>
            <Text style={styles.buttonText}>Retry</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#080d13' },
  webview: { flex: 1, backgroundColor: '#080d13' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#080d13' },
  progress: { position: 'absolute', top: 14, right: 14, padding: 8, borderRadius: 20, backgroundColor: '#101a23' },
  error: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 28, backgroundColor: '#080d13' },
  title: { color: '#edf4f8', fontSize: 20, fontWeight: '700' },
  muted: { color: '#93a3b5', fontSize: 13 },
  button: { marginTop: 8, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 8, backgroundColor: '#d9f9e4' },
  buttonText: { color: '#0b2116', fontWeight: '700' },
});
