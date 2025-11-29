import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useThemeStore } from '../src/store/theme';

export default function RootLayout() {
  const theme = useThemeStore((s) => s.theme);
  const dark = theme === 'dark';
  return (
    <View style={{ flex: 1, backgroundColor: dark ? '#111827' : 'white' }}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
