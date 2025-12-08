import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useThemeStore } from '../src/store/theme';
import { useFonts } from 'expo-font';

export default function RootLayout() {
  const theme = useThemeStore((s) => s.theme);
  const dark = theme === 'dark';
  // Load project font (HelloValentina) if present at mobile/assets/fonts/HelloValentina.ttf
  const [fontsLoaded] = useFonts({
    HelloValentina: require('../assets/fonts/HelloValentina.ttf'),
  });

  // Render UI regardless; font will be used when available (fallback used if not yet loaded)
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: dark ? '#111827' : 'white' }}>
        <StatusBar style={dark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false }} />
      </View>
    </SafeAreaProvider>
  );
}
