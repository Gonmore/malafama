import { Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeStore } from '../../src/store/theme';
import TopNav from '../components/TopNav';

export default function AdminDashboard() {
  const router = useRouter();
  const theme = useThemeStore?.((s) => s.theme) || 'light';
  const dark = theme === 'dark';
  const bg = dark ? '#111827' : 'white';
  const fg = dark ? 'white' : '#111827';
  const muted = dark ? '#9CA3AF' : '#6B7280';

  const [loading, setLoading] = useState(false);
  const [localId, setLocalId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const id = await AsyncStorage.getItem('selectedLocalId');
        setLocalId(id);
      } catch (e) {
        console.error('Error loading admin dashboard', e);
      }
    };
    
    loadData();
  }, []);

  const handleChangeLocal = async () => {
    try {
      await AsyncStorage.removeItem('selectedLocalId');
      await AsyncStorage.removeItem('selectedRole');
      router.replace('/home');
    } catch (e) {
      console.error('Error changing local', e);
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('selectedLocalId');
      await AsyncStorage.removeItem('selectedRole');
      router.replace('/login');
    } catch (e) {
      console.error('Error logging out', e);
    }
  };

  const menuItems = [
    { id: '1', label: '👥 Usuarios', icon: '👥', description: 'Gestionar usuarios del local' },
    { id: '2', label: '🪑 Mesas', icon: '🪑', description: 'Configurar mesas' },
    { id: '3', label: '📊 Reportes', icon: '📊', description: 'Ver reportes y estadísticas' },
    { id: '4', label: '📦 Productos', icon: '📦', description: 'Gestionar productos' },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <TopNav title="Admin - Dashboard" onOpenSettings={() => {}} />

      <ScrollView style={{ flex: 1, padding: 24 }}>
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: fg, marginBottom: 8 }}>
            Panel de Administración
          </Text>
          <Text style={{ color: muted, fontSize: 14 }}>
            Gestiona tu local desde aquí
          </Text>
        </View>

        <View style={{ gap: 12, marginBottom: 24 }}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: dark ? '#1F2937' : '#F3F4F6',
                padding: 16,
                borderRadius: 10,
                borderLeftWidth: 4,
                borderLeftColor: '#3b82f6',
              }}
            >
              <Text style={{ fontSize: 28, marginRight: 12 }}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: fg }}>
                  {item.label}
                </Text>
                <Text style={{ fontSize: 12, color: muted, marginTop: 4 }}>
                  {item.description}
                </Text>
              </View>
              <Text style={{ fontSize: 18, color: muted }}>→</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ gap: 12 }}>
          <TouchableOpacity
            onPress={handleChangeLocal}
            style={{
              backgroundColor: '#10b981',
              padding: 16,
              borderRadius: 10,
              alignItems: 'center'
            }}
          >
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
              Cambiar Local
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleLogout}
            style={{
              backgroundColor: '#ef4444',
              padding: 16,
              borderRadius: 10,
              alignItems: 'center'
            }}
          >
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
              Cerrar Sesión
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
