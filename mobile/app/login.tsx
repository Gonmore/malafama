import { useState } from 'react';
import { Link, useRouter } from 'expo-router';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../src/services/api';
import { useAuthStore } from '../src/store/auth';
import { useThemeStore } from '../src/store/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('admin@malafama.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);
  const theme = useThemeStore((s) => s.theme);
  const dark = theme === 'dark';
  const bg = dark ? '#111827' : 'white';
  const fg = dark ? 'white' : '#111827';
  const muted = dark ? '#9CA3AF' : '#6B7280';
  const setAuth = useAuthStore((s) => s.setAuth);
  const router = useRouter();

  const onLogin = async () => {
    try {
      setLoading(true);
      const { data } = await api.post('/auth/login', { email, password });

      // Backend sometimes returns the user object as `usuario` — accept either shape.
      const token = data?.token || data?.data?.token;
      const user = data?.user || data?.usuario || data?.data?.usuario || data?.data?.user || null;

      setAuth(token, user);


      // Redirect user to role-specific panel immediately after login
      const tipo = user?.tipo || 'admin';
      const route = tipo === 'atencion' ? '/mesero' : tipo === 'cocina' ? '/cocina' : tipo === 'proveedor' ? '/proveedor' : '/admin';
      // routing to role-specific screen
      router.replace(route);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Error de autenticación';
      Alert.alert('Login', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: bg }}>
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 28, fontWeight: '700', color: fg }}>MalaFama</Text>
        <Text style={{ color: muted, marginTop: 4 }}>Inicia sesión para continuar</Text>
      </View>

      <View style={{ gap: 12 }}>
        <Text style={{ color: dark ? '#D1D5DB' : '#374151' }}>Email</Text>
        <TextInput
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="email@dominio.com"
          value={email}
          onChangeText={setEmail}
          style={{ borderWidth: 1, borderColor: dark ? '#1F2937' : '#E5E7EB', borderRadius: 8, padding: 12, backgroundColor: dark ? '#0b1220' : 'white', color: fg }}
        />

        <Text style={{ color: dark ? '#D1D5DB' : '#374151', marginTop: 8 }}>Password</Text>
        <TextInput
          placeholder="********"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={{ borderWidth: 1, borderColor: dark ? '#1F2937' : '#E5E7EB', borderRadius: 8, padding: 12, backgroundColor: dark ? '#0b1220' : 'white', color: fg }}
        />
      </View>

      <TouchableOpacity
        disabled={loading}
        onPress={onLogin}
        style={{ marginTop: 24, backgroundColor: '#ef4444', padding: 14, borderRadius: 10, alignItems: 'center' }}
      >
        <Text style={{ color: 'white', fontWeight: '700' }}>{loading ? 'Ingresando…' : 'Ingresar'}</Text>
      </TouchableOpacity>

      <View style={{ marginTop: 16 }}>
        <Link href="/home" asChild>
          <TouchableOpacity>
            <Text style={{ textAlign: 'center', color: muted }}>Continuar sin login (demo)</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </SafeAreaView>
  );
}
