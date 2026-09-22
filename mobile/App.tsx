import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { WebView, type WebViewNavigation } from 'react-native-webview';

// Native shell around the Villano web app: the whole UI lives in the WebView,
// this file only handles loading, errors, the Android back button and the
// safe areas. The server address comes from app.json → extra.appUrl.
const APP_URL: string = Constants.expoConfig?.extra?.appUrl ?? 'http://localhost:5173';

const DARK = '#0a0a0a';

void SplashScreen.preventAutoHideAsync();

export default function App() {
  const webview = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  // Android hardware back → navigate inside the web app instead of closing
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
        webview.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack]);

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
  }, []);

  const hideSplash = useCallback(() => {
    setLoading(false);
    void SplashScreen.hideAsync();
  }, []);

  const retry = () => {
    setError(null);
    setLoading(true);
    webview.current?.reload();
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <StatusBar style="light" />

        {error ? (
          <View style={styles.center}>
            <Text style={styles.title}>Serveur injoignable</Text>
            <Text style={styles.text}>
              Impossible de joindre {APP_URL}.{'\n'}
              Vérifiez que le téléphone est sur le même Wi-Fi que le PC et que
              « npm run dev » tourne.
            </Text>
            <Text style={styles.detail}>{error}</Text>
            <Pressable style={styles.button} onPress={retry}>
              <Text style={styles.buttonText}>Réessayer</Text>
            </Pressable>
          </View>
        ) : (
          <WebView
            ref={webview}
            source={{ uri: APP_URL }}
            style={styles.web}
            onLoadEnd={hideSplash}
            onError={(e) => {
              setError(e.nativeEvent.description || 'Erreur de connexion');
              hideSplash();
            }}
            onHttpError={(e) => {
              if (e.nativeEvent.statusCode >= 500) setError(`HTTP ${e.nativeEvent.statusCode}`);
            }}
            onNavigationStateChange={onNavigationStateChange}
            // Behave like an installed app, not a browser
            allowsBackForwardNavigationGestures
            pullToRefreshEnabled
            bounces={false}
            setSupportMultipleWindows={false}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            // Keep the session (localStorage token) between launches
            domStorageEnabled
            sharedCookiesEnabled
            cacheEnabled
            // File inputs (product photos) on Android
            allowFileAccess
          />
        )}

        {loading && !error && (
          <View style={styles.loader} pointerEvents="none">
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: DARK },
  web: { flex: 1, backgroundColor: '#f4f4f5' },
  loader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DARK,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: DARK,
  },
  title: { color: '#fafaf9', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  text: { color: '#a8a29e', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  detail: { color: '#78716c', fontSize: 12, marginTop: 12, textAlign: 'center' },
  button: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#171717',
    borderRadius: 8,
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
