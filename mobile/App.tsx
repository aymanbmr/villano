import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView, type WebViewNavigation } from 'react-native-webview';

// Native shell around the Villano web app: the whole UI lives in the WebView,
// this file only handles loading, errors, the Android back button and the
// address of the caisse server.
//
// Cette application est celle du gérant : carte, ventes, employés. Pas la
// caisse — on ne prend pas les commandes sur un téléphone pendant le service.
// La coque le signale au site par son user agent (applicationNameForUserAgent
// ci-dessous), et le site masque alors la caisse. Passer par l'adresse aurait
// été plus simple mais fragile : le paramètre disparaît au premier
// rechargement, et la caisse réapparaîtrait sans qu'on comprenne pourquoi.
//
// That address is editable inside the app: the café's PC gets a new IP from
// the router now and then, and a hard-coded URL would leave the installed app
// dead until someone rebuilds it.
const DEFAULT_URL: string = Constants.expoConfig?.extra?.appUrl ?? 'http://localhost:3000';
const URL_KEY = 'villano.serverUrl';

const DARK = '#0a0a0a';

void SplashScreen.preventAutoHideAsync();

const normalize = (value: string) => {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
};

export default function App() {
  const webview = useRef<WebView>(null);
  const [url, setUrl] = useState<string | null>(null); // null = still reading storage
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [canGoBack, setCanGoBack] = useState(false);

  // A stored address wins over the one baked in at build time
  useEffect(() => {
    void AsyncStorage.getItem(URL_KEY)
      .then((stored) => setUrl(stored || DEFAULT_URL))
      .catch(() => setUrl(DEFAULT_URL));
  }, []);

  // Android hardware back → navigate inside the web app instead of closing
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (editing) {
        setEditing(false);
        return true;
      }
      if (canGoBack) {
        webview.current?.goBack();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [canGoBack, editing]);

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

  const openSettings = () => {
    setDraft(url ?? DEFAULT_URL);
    setEditing(true);
  };

  const saveSettings = async () => {
    const next = normalize(draft);
    if (!next) return;
    await AsyncStorage.setItem(URL_KEY, next).catch(() => undefined);
    setUrl(next);
    setEditing(false);
    setError(null);
    setLoading(true);
  };

  if (url === null) return null; // first frame: the splash screen is still up

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
        <StatusBar style="light" />

        {editing ? (
          <View style={styles.center}>
            <Text style={styles.title}>Adresse du serveur</Text>
            <Text style={styles.text}>
              Adresse de la caisse sur le réseau du restaurant, par exemple{'\n'}
              http://192.168.1.10:3000
            </Text>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="http://192.168.1.10:3000"
              placeholderTextColor="#57534e"
            />
            <Pressable style={styles.button} onPress={saveSettings}>
              <Text style={styles.buttonText}>Enregistrer</Text>
            </Pressable>
            <Pressable style={styles.linkButton} onPress={() => setEditing(false)}>
              <Text style={styles.link}>Annuler</Text>
            </Pressable>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.title}>Serveur injoignable</Text>
            <Text style={styles.text}>
              Impossible de joindre {url}.{'\n'}
              Vérifiez que le téléphone est sur le même Wi-Fi que le PC de la caisse et que Villano
              y est lancé.
            </Text>
            <Text style={styles.detail}>{error}</Text>
            <Pressable style={styles.button} onPress={retry}>
              <Text style={styles.buttonText}>Réessayer</Text>
            </Pressable>
            <Pressable style={styles.linkButton} onPress={openSettings}>
              <Text style={styles.link}>Changer l’adresse du serveur</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <WebView
              ref={webview}
              key={url}
              source={{ uri: url }}
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
              // Ajouté à la fin du user agent : c'est ce que le site lit pour
              // savoir qu'il tourne dans l'application du gérant.
              applicationNameForUserAgent="VillanoAdmin"
              // Behave like an installed app, not a browser
              allowsBackForwardNavigationGestures
              pullToRefreshEnabled
              bounces={false}
              setSupportMultipleWindows={false}
              allowsInlineMediaPlayback
              mediaPlaybackRequiresUserAction={false}
              // Keep the session (PIN login) between launches
              domStorageEnabled
              sharedCookiesEnabled
              cacheEnabled
              // File inputs (product photos) on Android
              allowFileAccess
            />
            {/* Discreet way back to the address screen while everything works */}
            <Pressable style={styles.gear} onPress={openSettings} hitSlop={12}>
              <Text style={styles.gearText}>···</Text>
            </Pressable>
          </>
        )}

        {loading && !error && !editing && (
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
  web: { flex: 1, backgroundColor: '#f5f5f5' },
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
  title: { color: '#ffffff', fontSize: 20, fontWeight: '700', marginBottom: 12 },
  text: { color: '#a3a3a3', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  detail: { color: '#737373', fontSize: 12, marginTop: 12, textAlign: 'center' },
  input: {
    width: '100%',
    marginTop: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 16,
    backgroundColor: '#171717',
    borderColor: '#404040',
    borderWidth: 1,
    borderRadius: 8,
  },
  button: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
  },
  buttonText: { color: DARK, fontWeight: '700', fontSize: 15 },
  linkButton: { marginTop: 16, padding: 8 },
  link: { color: '#a3a3a3', fontSize: 14, textDecorationLine: 'underline' },
  gear: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.2,
  },
  gearText: { color: '#000000', fontSize: 18, fontWeight: '700' },
});
