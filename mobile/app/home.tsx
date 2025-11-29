import { useEffect } from 'react';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView, Text, TouchableOpacity, View } from 'react-native';
import { useAuthStore } from '../src/store/auth';
import { createSocket, disconnectSocket } from '../src/services/socket';
import { useThemeStore } from '../src/store/theme';
import ThemeSwitch from '../src/components/ThemeSwitch';

export default function Home() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const router = useRouter();
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);

  useEffect(() => {
    if (token) {
      const s = createSocket(token);
      // intentionally quiet on connect — socket lifecycle handled elsewhere
    }
    return () => disconnectSocket();
  }, [token]);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [token]);

  const tipo = user?.tipo || 'admin';

  const defaultRoute =
    tipo === 'atencion' ? '/mesero' : tipo === 'cocina' ? '/cocina' : tipo === 'proveedor' ? '/proveedor' : '/admin';

  const dark = theme === 'dark';
  const bg = dark ? '#111827' : 'white';
  const fg = dark ? 'white' : '#111827';
  const muted = dark ? '#9CA3AF' : '#6B7280';

  return (
    <SafeAreaView style={{ flex: 1, padding: 24, paddingTop: 60, backgroundColor: bg }}>
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: fg }}>Bienvenido{user?.nombre ? `, ${user.nombre}` : ''}</Text>
        <Text style={{ color: muted, marginTop: 4 }}>Selecciona tu panel</Text>
      </View>

      <View style={{ gap: 12 }}>
        <Link href={defaultRoute} asChild>
          <TouchableOpacity style={{ backgroundColor: '#111827', padding: 14, borderRadius: 10 }}>
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>Ir a mi panel</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/mesero" asChild>
          <TouchableOpacity style={{ backgroundColor: '#38bdf8', padding: 14, borderRadius: 10 }}>
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>Mesero</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/cocina" asChild>
          <TouchableOpacity style={{ backgroundColor: '#10b981', padding: 14, borderRadius: 10 }}>
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>Cocina</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/bar" asChild>
          <TouchableOpacity style={{ backgroundColor: '#0891b2', padding: 14, borderRadius: 10 }}>
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>Bar</Text>
          </TouchableOpacity>
        </Link>

        <Link href="/admin" asChild>
          <TouchableOpacity style={{ backgroundColor: '#1e40af', padding: 14, borderRadius: 10 }}>
            <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>Admin</Text>
          </TouchableOpacity>
        </Link>
      </View>

      <View style={{ marginTop: 20, gap: 10 }}>
        <View style={{ padding: 12, alignItems: 'center' }}>
          <ThemeSwitch />
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={{ textAlign: 'center', color: muted }}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
