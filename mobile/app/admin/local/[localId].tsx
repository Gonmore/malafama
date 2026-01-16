import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, Text, View, TouchableOpacity, Image, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { localService } from '../../../src/services/local';
import { useThemeStore } from '../../../src/store/theme';
import { showErrorAlert } from '../../../src/utils/errorHandler';
import TopNav from '../../components/TopNav';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ROLES = [
  { key: 'mesero', label: 'Mesero', emoji: '🪑', color: '#3b82f6', desc: 'Gestiona mesas y comandas' },
  { key: 'bar', label: 'Bar', emoji: '🍸', color: '#8b5cf6', desc: 'Prepara bebidas' },
  { key: 'cocina', label: 'Cocina', emoji: '👨‍🍳', color: '#f59e0b', desc: 'Prepara comidas' },
  { key: 'admin', label: 'Admin', emoji: '⚙️', color: '#10b981', desc: 'Configuración del local' },
];

export default function LocalPanel() {
  const router = useRouter();
  const { localId } = useLocalSearchParams<{ localId: string }>();
  const [local, setLocal] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  
  const theme = useThemeStore((s) => s.theme);
  const dark = theme === 'dark';
  const bg = dark ? '#111827' : 'white';
  const fg = dark ? 'white' : '#111827';
  const muted = dark ? '#9CA3AF' : '#6B7280';

  let lightFooterLogo: any = null;
  let darkFooterLogo: any = null;
  try {
    lightFooterLogo = require('../../../assets/SNT_logo/Logo_Azul.png');
    darkFooterLogo = require('../../../assets/SNT_logo/Logo_Blanco.png');
  } catch (err) {
    // fallback
  }

  const window = Dimensions.get('window');
  const footerHeight = Math.max(56, Math.round(window.height * 0.072));

  useEffect(() => {
    const loadLocal = async () => {
      try {
        if (!localId) return;
        const data = await localService.obtenerLocalPorId(localId);
        setLocal(data);
      } catch (e) {
        console.error('Error cargando local:', e);
        showErrorAlert(e);
      } finally {
        setLoading(false);
      }
    };
    loadLocal();
  }, [localId]);

  const handleSelectRole = async (role: string) => {
    try {
      if (!localId) throw new Error('Local ID no encontrado');
      
      // Set role and local ID first
      await AsyncStorage.setItem('selectedRole', role);
      await AsyncStorage.setItem('selectedLocalId', localId.toString());
      
      // Define route map
      const routeMap: Record<string, string> = {
        mesero: '/mesero',
        bar: '/bar',
        cocina: '/cocina',
        admin: '/admin/dashboard'
      };
      
      const targetRoute = routeMap[role] || '/home';
      
      // Use a small delay to ensure storage is written before navigation
      setTimeout(() => {
        router.replace(targetRoute);
      }, 100);
    } catch (e) {
      console.error('Error seleccionando rol:', e);
      Alert.alert('Error', 'No se pudo seleccionar el rol');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: bg, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: fg }}>Cargando...</Text>
      </SafeAreaView>
    );
  }

  if (!local) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
        <TopNav title="Local" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
          <Text style={{ color: fg, fontSize: 18, fontWeight: '600', textAlign: 'center' }}>Local no encontrado</Text>
          <TouchableOpacity 
            onPress={() => router.back()}
            style={{ marginTop: 24, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#3b82f6', borderRadius: 8 }}
          >
            <Text style={{ color: 'white', fontWeight: '600' }}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <TopNav title={local?.nombre || 'Local'} localLogo={local?.logo || local?.logo_url} onOpenSettings={() => {}} />

      <ScrollView style={{ flex: 1, paddingHorizontal: 24, paddingTop: 24, paddingBottom: footerHeight + 24 }}>
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: fg, marginBottom: 8 }}>Selecciona tu panel</Text>
          <Text style={{ color: muted, marginBottom: 16 }}>¿En qué área trabajarás hoy?</Text>
        </View>

        <View style={{ gap: 12 }}>
          {ROLES.map((role) => (
            <TouchableOpacity
              key={role.key}
              onPress={() => handleSelectRole(role.key)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 20,
                backgroundColor: dark ? '#1F2937' : '#F3F4F6',
                borderRadius: 12,
                borderWidth: 2,
                borderColor: role.color,
                gap: 16
              }}
            >
              <Text style={{ fontSize: 48 }}>{role.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: fg }}>{role.label}</Text>
                <Text style={{ color: muted, marginTop: 4, fontSize: 13 }}>{role.desc}</Text>
              </View>
              <Text style={{ fontSize: 20, color: muted }}>→</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: footerHeight, backgroundColor: bg, justifyContent: 'center', alignItems: 'center', borderTopWidth: 1, borderTopColor: dark ? '#374151' : '#E5E7EB' }}>
        {lightFooterLogo && darkFooterLogo ? (
          <Image source={dark ? darkFooterLogo : lightFooterLogo} style={{ height: footerHeight * 0.6, resizeMode: 'contain' }} />
        ) : (
          <Text style={{ color: muted, fontSize: 12 }}>MalaFama</Text>
        )}
      </View>
    </SafeAreaView>
  );
}
