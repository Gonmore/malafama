import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Text, TouchableOpacity, View, ScrollView, Image, Dimensions, Modal, TextInput, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import TopNav from '../components/TopNav';
import { pedidoService, Pedido } from '../../src/services/pedido';
import { formatTimeShort, getMinutosTranscurridos } from '../../src/utils/time';
import { useThemeStore } from '../../src/store/theme';
import { PRIMARY } from '../../src/constants/colors';
import { getSocket } from '../../src/services/socket';
import { notifySuccess } from '../../src/utils/notify';
import { useAuthStore } from '../../src/store/auth';
import { localService } from '../../src/services/local';
import * as ImagePicker from 'expo-image-picker';

type Mode = 'por-pedido' | 'por-pedido-compacto' | 'por-producto' | 'por-producto-compacto' | 'por-mesa';
type Tab = 'cola' | 'recientes';

export default function BarDashboard() {
  const { user } = useAuthStore();
  const logout = useAuthStore((s) => s.logout);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [localId, setLocalId] = useState<number | null>(user?.localId ?? null);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const setTheme = useThemeStore((s) => s.set);
  const dark = theme === 'dark';
  const bg = dark ? '#111827' : 'white';
  const fg = dark ? 'white' : '#111827';
  const muted = dark ? '#9CA3AF' : '#6B7280';
  const isAdmin = user?.tipo === 'admin';
  const router = useRouter();

  let lightFooterLogo: any = null;
  let darkFooterLogo: any = null;
  try {
    lightFooterLogo = require('../../assets/SNT_logo/Logo_Azul.png');
    darkFooterLogo = require('../../assets/SNT_logo/Logo_Blanco.png');
  } catch (err) {
    // fallback to text
  }

  const window = Dimensions.get('window');
  const footerHeight = Math.max(56, Math.round(window.height * 0.072));
  const [items, setItems] = useState<Pedido[]>([]);
  const [recents, setRecents] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('por-producto-compacto');
  const [tab, setTab] = useState<Tab>('cola');
  const [notaModal, setNotaModal] = useState<{ visible: boolean; nota: string }>({ visible: false, nota: '' });
  const [showModal, setShowModal] = useState(false);
  const [tempNombre, setTempNombre] = useState(user?.nombre || '');
  const [localLogo, setLocalLogo] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const data = await pedidoService.getPendientesCocina({ tipo: 'bebida', localId: localId ?? undefined });
      // payload returned by API processed below
      setItems(Array.isArray(data) ? data : data?.data || data?.pedidos || []);
      const r = await pedidoService.getRecientes({ tipo: 'bebida', localId: localId ?? undefined });
      // recent items returned by API processed below
      setRecents(Array.isArray(r) ? r : r?.data || r?.pedidos || []);
    } catch (e) {
      Alert.alert('Bar', 'No se pudo cargar la cola');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Ensure we have a localId if possible
    const ensureLocal = async () => {
      if (!localId) {
        try {
          const res = await localService.obtenerLocales();
          const list = Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res)
            ? res
            : Array.isArray((res as any)?.locales)
            ? (res as any).locales
            : [];
          const first = list?.[0] || null;
          if (first?.id) setLocalId(first.id);
        } catch {}
      }
    };
    // Restore persisted mode
    const restore = async () => {
      try {
        const saved = await AsyncStorage.getItem('bar_modo_vista');
          const allowed = ['por-pedido','por-pedido-compacto','por-producto','por-producto-compacto','por-mesa'];
          if (saved && (allowed as string[]).includes(saved)) setMode(saved as Mode);
      } catch {}
    };
    ensureLocal();
    restore();
  }, []);

  useEffect(() => {
    setTempNombre(user?.nombre || '');
  }, [user?.nombre]);

  useEffect(() => {
    load();

    const loadLocalLogo = async () => {
      if (user?.localId) {
        try {
          const locales = await localService.obtenerLocales();
          const local = Array.isArray(locales) ? locales.find(l => l.id === user.localId) : null;
          if (local?.logo) {
            setLocalLogo(local.logo);
          }
        } catch (e) {
          console.error('Error loading local logo', e);
        }
      }
    };
    loadLocalLogo();

    // Conectar al socket para actualizaciones en tiempo real
    const socket = getSocket();
    if (socket) {
      // Join generic role room and local-scoped room if available
      socket.emit('join-room', 'bar');
      if (localId) socket.emit('join-room', `bar:${localId}`);
    }
    const onNew = async () => {
      await notifySuccess();
      load();
    };
    socket?.on('nuevo-pedido-bar', onNew);
    socket?.on('nueva-comanda', onNew);
    socket?.on('nuevos-pedidos', onNew);
    socket?.on('pedido-cancelado', onNew);
    return () => {
      socket?.off('nuevo-pedido-bar', onNew);
      socket?.off('nueva-comanda', onNew);
      socket?.off('nuevos-pedidos', onNew);
      socket?.off('pedido-cancelado', onNew);
    };
  }, [localId]);

  const groupByProducto = useMemo(() => {
    const map = new Map<string, Pedido[]>();
    for (const p of items) {
      const key = p?.producto?.nombre || 'Sin nombre';
      const arr = map.get(key) || [];
      arr.push(p);
      map.set(key, arr);
    }
    return map;
  }, [items]);

  const groupByMesa = useMemo(() => {
    const map = new Map<string, Pedido[]>();
    for (const p of items) {
      const key = String(p?.comanda?.mesa?.numero ?? p?.comanda?.mesa?.nombre ?? 'Sin mesa');
      const arr = map.get(key) || [];
      arr.push(p);
      map.set(key, arr);
    }
    return map;
  }, [items]);

  const marcarListo = async (id: number) => {
    try {
      await pedidoService.marcarListo(id);
      await notifySuccess();
      load();
    } catch (e) {
      Alert.alert('Pedido', 'No se pudo marcar como listo');
    }
  };

  const desmarcarListo = async (id: number) => {
    try {
      await pedidoService.desmarcarListo(id);
      load();
    } catch (e) {
      Alert.alert('Pedido', 'No se pudo desmarcar como listo');
    }
  };

  const completarMesa = async (mesaKey: string) => {
    const pedidos = groupByMesa.get(mesaKey) || [];
    if (!pedidos.length) return;
    try {
      await Promise.all(pedidos.map((p) => pedidoService.marcarListo(p.id)));
      await notifySuccess();
      load();
    } catch (e) {
      Alert.alert('Bar', 'No se pudieron marcar todos como listos');
    }
  };

  const pickImageFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.granted) {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ((ImagePicker as any).MediaType?.Images ?? (ImagePicker as any).MediaTypeOptions?.Images),
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        updateUser({ photo: uri });
      }
    }
  };

  const pickImageFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.granted) {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        updateUser({ photo: uri });
      }
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, paddingBottom: footerHeight + 12, backgroundColor: bg }}>
      {/* Top nav (uses TopNav to render local logos reliably and handle logout redirect) */}
      <TopNav title="Bar" localLogo={localLogo} onOpenSettings={() => setShowModal(true)} />

      {/* Botón de retroceso */}
      {isAdmin && (
        <View style={{ position: 'absolute', top: 45, right: 20, zIndex: 10 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              backgroundColor: dark ? '#F3F4F6' : '#1F2937',
              borderRadius: 22,
              width: 44,
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: dark ? '#E5E7EB' : '#374151'
            }}
          >
            <Text style={{ fontSize: 32, color: dark ? '#111827' : 'white', marginTop: -10 }}>⬅</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ padding: 16, paddingTop: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: fg }}>Bar — Pendientes</Text>
        </View>
        {/* Tabs: Cola | Recientes */}
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          {([
            { key: 'cola', label: `Cola (${items.length})` },
            { key: 'recientes', label: `Recientes (${recents.length})` },
          ] as { key: Tab; label: string }[]).map((t) => (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                marginRight: 8,
                borderBottomWidth: 2,
                borderColor: tab === t.key ? '#2563EB' : 'transparent',
              }}
            >
              <Text style={{ color: tab === t.key ? '#2563EB' : muted, fontWeight: '700' }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          {([
            { key: 'por-producto-compacto', label: 'Por producto · compacto' },
            { key: 'por-pedido-compacto', label: 'Por pedido · compacto' },
            { key: 'por-pedido', label: 'Por pedido' },
            { key: 'por-producto', label: 'Por producto' },
            { key: 'por-mesa', label: 'Por mesa' },
          ] as { key: Mode; label: string }[]).map((b) => (
            <TouchableOpacity
              key={b.key}
              onPress={async () => {
                setMode(b.key);
                try {
                  await AsyncStorage.setItem('bar_modo_vista', b.key);
                } catch {}
              }}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                marginRight: 8,
                borderRadius: 8,
                backgroundColor: mode === b.key ? (dark ? '#1E3A8A' : '#DBEAFE') : (dark ? '#1F2937' : '#F3F4F6'),
                borderWidth: 1,
                borderColor: mode === b.key ? PRIMARY : (dark ? '#374151' : '#E5E7EB'),
              }}
            >
              <Text style={{ color: mode === b.key ? (dark ? '#DBEAFE' : '#1D4ED8') : (dark ? '#D1D5DB' : '#374151'), fontWeight: '600' }}>{b.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {(tab === 'cola' && (mode === 'por-pedido' || mode === 'por-pedido-compacto')) && (
        <FlatList
          contentContainerStyle={{ padding: 12 }}
          data={items}
          keyExtractor={(p) => String(p.id)}
          renderItem={({ item }) => (
            <View
              style={{
                backgroundColor: dark ? '#0b1220' : '#F9FAFB',
                borderColor: dark ? '#1F2937' : '#E5E7EB',
                borderWidth: 1,
                borderRadius: 12,
                padding: mode === 'por-pedido-compacto' ? 8 : 12,
                marginBottom: 10,
                flexDirection: mode === 'por-pedido-compacto' ? 'row' : 'column',
                alignItems: mode === 'por-pedido-compacto' ? 'center' : 'flex-start',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1, paddingRight: mode === 'por-pedido-compacto' ? 8 : 0 }}>
                <Text style={{ fontWeight: '700', color: fg }}>
                  {item.cantidad}× {item.producto?.nombre || 'Producto'}
                </Text>
                <Text style={{ color: muted, marginTop: 4 }}>Mesa: {item?.comanda?.mesa?.numero ?? item?.comanda?.mesa?.nombre ?? '—'}</Text>
                {!!item.notas && mode !== 'por-pedido-compacto' && (
                  <Text style={{ color: muted, marginTop: 4 }}>📝 {item.notas}</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => marcarListo(item.id)}
                style={{
                  marginTop: mode === 'por-pedido-compacto' ? 0 : 8,
                  backgroundColor: '#22c55e',
                  padding: mode === 'por-pedido-compacto' ? 10 : 10,
                  borderRadius: mode === 'por-pedido-compacto' ? 999 : 8,
                  minWidth: mode === 'por-pedido-compacto' ? 44 : undefined,
                }}
              >
                <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>
                  {mode === 'por-pedido-compacto' ? '✓' : 'Marcar listo'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={{ padding: 24 }}>
              <Text style={{ textAlign: 'center', color: muted }}>No hay pedidos pendientes</Text>
            </View>
          )}
        />
      )}

      {tab === 'cola' && (mode === 'por-producto' || mode === 'por-producto-compacto') && (
        <ScrollView contentContainerStyle={{ padding: 12 }}>
          {Array.from(groupByProducto.entries()).map(([producto, pedidos]) => {
            // Ordenar por antigüedad (más antiguos primero)
            const pedidosOrdenados = pedidos.sort((a, b) => {
              const timeA = new Date(a?.createdAt || a?.created_at || 0).getTime();
              const timeB = new Date(b?.createdAt || b?.created_at || 0).getTime();
              return timeA - timeB;
            });
            return (
              <View key={producto} style={{ marginBottom: 16, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: dark ? '#1F2937' : '#E5E7EB' }}>
                <View style={{ backgroundColor: dark ? '#111827' : '#3B82F6', paddingHorizontal: 12, paddingVertical: 8 }}>
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>{producto}</Text>
                  <Text style={{ color: dark ? '#D1D5DB' : '#DBEAFE' }}>{pedidos.length} pendiente(s)</Text>
                </View>
                {mode === 'por-producto' ? (
                  <ScrollView horizontal contentContainerStyle={{ padding: 12, paddingBottom: footerHeight + 32 }} showsHorizontalScrollIndicator={false}>
                    {pedidosOrdenados.map((p) => {
                      const minutos = getMinutosTranscurridos(p?.createdAt || p?.created_at);
                      const esListo = p?.estado === 'listo';
                      const puedeDesmarcar = esListo && minutos <= 5;
                      // Colores según tiempo: verde <=5, amarillo 5-8, rojo >8
                      const colorTiempo = esListo ? '#9CA3AF' : minutos <= 5 ? '#10B981' : minutos <= 8 ? '#F59E0B' : '#EF4444';
                      return (
                        <View
                          key={p.id}
                          style={{
                            flexDirection: 'row',
                            backgroundColor: esListo ? '#E5E7EB' : (dark ? '#1F2937' : '#F9FAFB'),
                            borderColor: esListo ? '#9CA3AF' : (dark ? '#374151' : '#E5E7EB'),
                            borderWidth: 1,
                            borderRadius: 8,
                            padding: 8,
                            marginRight: 8,
                            opacity: esListo ? 0.6 : 1,
                            minHeight: 100,
                          }}
                        >
                          {!!p.notas && (
                            <TouchableOpacity 
                              onPress={() => setNotaModal({ visible: true, nota: p.notas || '' })}
                              style={{ 
                                backgroundColor: esListo ? '#D1D5DB' : '#FEF3C7', 
                                paddingHorizontal: 2, 
                                paddingVertical: 4, 
                                borderRadius: 4, 
                                marginRight: 4,
                                justifyContent: 'center',
                                alignItems: 'center',
                                width: 14,
                              }}
                            >
                              <Text style={{ 
                                color: esListo ? '#374151' : '#78350F', 
                                fontSize: 9,
                                fontWeight: '600',
                                writingDirection: 'ltr',
                                transform: [{ rotate: '-90deg' }],
                                width: 80,
                                textAlign: 'center',
                              }} numberOfLines={1}>{p.notas}</Text>
                            </TouchableOpacity>
                          )}
                          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontWeight: '700', color: esListo ? '#6B7280' : (dark ? '#F3F4F6' : fg), textAlign: 'center', fontSize: 16 }}>x{p.cantidad}</Text>
                            <Text style={{ color: esListo ? '#9CA3AF' : (dark ? '#D1D5DB' : '#374151'), textAlign: 'center', marginTop: 2, fontSize: 11 }}>Mesa {p?.comanda?.mesa?.numero ?? p?.comanda?.mesa?.nombre ?? '—'}</Text>
                            <Text style={{ color: colorTiempo, textAlign: 'center', marginTop: 2, fontSize: 12, fontWeight: '600' }}>{minutos} min</Text>
                            {!esListo ? (
                              <TouchableOpacity onPress={() => marcarListo(p.id)} style={{ marginTop: 6, backgroundColor: '#22c55e', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 }}>
                                <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700', fontSize: 14 }}>✓</Text>
                              </TouchableOpacity>
                            ) : puedeDesmarcar ? (
                              <TouchableOpacity onPress={() => desmarcarListo(p.id)} style={{ marginTop: 6, backgroundColor: '#F59E0B', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 }}>
                                <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700', fontSize: 14 }}>↻</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <ScrollView horizontal contentContainerStyle={{ padding: 8, paddingBottom: footerHeight + 32 }} showsHorizontalScrollIndicator={false}>
                    {pedidosOrdenados.map((p) => {
                      const minutos = getMinutosTranscurridos(p?.createdAt || p?.created_at);
                      const esListo = p?.estado === 'listo';
                      const puedeDesmarcar = esListo && minutos <= 5;
                      const colorTiempo = esListo ? '#9CA3AF' : minutos <= 5 ? '#10B981' : minutos <= 8 ? '#F59E0B' : '#EF4444';
                      return (
                        <View
                          key={p.id}
                          style={{
                            flexDirection: 'row',
                            backgroundColor: esListo ? '#E5E7EB' : (dark ? '#1F2937' : '#F9FAFB'),
                            borderColor: esListo ? '#9CA3AF' : (dark ? '#374151' : '#E5E7EB'),
                            borderWidth: 1,
                            borderRadius: 8,
                            padding: 6,
                            marginRight: 6,
                            opacity: esListo ? 0.6 : 1,
                            minHeight: 100,
                          }}
                        >
                          {!!p.notas && (
                            <TouchableOpacity 
                              onPress={() => setNotaModal({ visible: true, nota: p.notas || '' })}
                              style={{ 
                                backgroundColor: esListo ? '#D1D5DB' : '#FEF3C7', 
                                paddingHorizontal: 1, 
                                paddingVertical: 3, 
                                borderRadius: 3, 
                                marginRight: 3,
                                justifyContent: 'center',
                                alignItems: 'center',
                                width: 10,
                              }}
                            >
                              <Text style={{ 
                                color: esListo ? '#374151' : '#78350F', 
                                fontSize: 8,
                                fontWeight: '600',
                                writingDirection: 'ltr',
                                transform: [{ rotate: '-90deg' }],
                                width: 60,
                                textAlign: 'center',
                              }} numberOfLines={1}>{p.notas}</Text>
                            </TouchableOpacity>
                          )}
                          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontWeight: '700', color: esListo ? '#6B7280' : (dark ? '#F3F4F6' : fg), fontSize: 18 }}>x{p.cantidad}</Text>
                            <View style={{ height: 1, width: '100%', backgroundColor: esListo ? '#D1D5DB' : (dark ? '#4B5563' : '#E5E7EB'), marginVertical: 4 }} />
                            <Text style={{ color: esListo ? '#9CA3AF' : (dark ? '#D1D5DB' : muted), fontSize: 9, textAlign: 'center' }}>M{p?.comanda?.mesa?.numero ?? p?.comanda?.mesa?.nombre ?? '?'}</Text>
                            <Text style={{ color: colorTiempo, fontSize: 10, fontWeight: '600', marginTop: 2 }}>{minutos}m</Text>
                            {!esListo ? (
                              <TouchableOpacity onPress={() => marcarListo(p.id)} style={{ marginTop: 4, backgroundColor: '#22c55e', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>✓</Text>
                              </TouchableOpacity>
                            ) : puedeDesmarcar ? (
                              <TouchableOpacity onPress={() => desmarcarListo(p.id)} style={{ marginTop: 4, backgroundColor: '#F59E0B', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>↻</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            );
          })}
          {items.length === 0 && (
            <View style={{ padding: 24 }}>
              <Text style={{ textAlign: 'center', color: muted }}>No hay pedidos pendientes</Text>
            </View>
          )}
        </ScrollView>
      )}

      {tab === 'cola' && mode === 'por-mesa' && (
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: footerHeight + 32 }}>
          {Array.from(groupByMesa.entries()).map(([mesa, pedidos]) => (
            <View key={mesa} style={{ marginBottom: 16, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: dark ? '#1F2937' : '#E5E7EB' }}>
              <View style={{ backgroundColor: dark ? '#0b1220' : '#111827', paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Mesa {mesa}</Text>
                <TouchableOpacity onPress={() => completarMesa(mesa)} style={{ backgroundColor: '#22c55e', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}>
                  <Text style={{ color: 'white', fontWeight: '700' }}>Completar mesa</Text>
                </TouchableOpacity>
              </View>
              <View style={{ padding: 12 }}>
                {pedidos.map((p) => (
                  <View
                    key={p.id}
                    style={{
                      backgroundColor: dark ? '#0b1220' : '#F9FAFB',
                      borderColor: dark ? '#1F2937' : '#E5E7EB',
                      borderWidth: 1,
                      borderRadius: 10,
                      padding: 10,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ fontWeight: '700', color: fg }}>{p.cantidad}× {p?.producto?.nombre || 'Producto'}</Text>
                    {!!p.notas && <Text style={{ color: muted, marginTop: 4 }}>📝 {p.notas}</Text>}
                    <TouchableOpacity onPress={() => marcarListo(p.id)} style={{ marginTop: 8, backgroundColor: '#22c55e', padding: 8, borderRadius: 8 }}>
                      <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>Listo</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          ))}
          {items.length === 0 && (
            <View style={{ padding: 24 }}>
              <Text style={{ textAlign: 'center', color: muted }}>No hay pedidos pendientes</Text>
            </View>
          )}
        </ScrollView>
      )}

      {tab === 'recientes' && (
        <FlatList
          contentContainerStyle={{ padding: 12, paddingBottom: footerHeight + 32 }}
          data={recents}
          keyExtractor={(p) => String(p.id)}
          renderItem={({ item }) => {
            const minutosDesdeListo = item.listoAt ? getMinutosTranscurridos(item.listoAt) : 999;
            const puedeDesmarcar = minutosDesdeListo <= 3;
            return (
              <View
                style={{
                  backgroundColor: dark ? '#052e20' : '#ECFDF5',
                  borderColor: dark ? '#065F46' : '#10B981',
                  borderWidth: 1,
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 10,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: '#065F46' }}>
                      ✓ {item.cantidad}× {item.producto?.nombre || 'Producto'}
                    </Text>
                    <Text style={{ color: dark ? '#6EE7B7' : '#047857', marginTop: 2, fontSize: 12 }}>
                      Mesa {item?.comanda?.mesa?.numero ?? item?.comanda?.mesa?.nombre ?? '—'} • {formatTimeShort(item?.listoAt || item?.createdAt || item?.created_at)}
                    </Text>
                  </View>
                  {puedeDesmarcar && (
                    <TouchableOpacity 
                      onPress={() => desmarcarListo(item.id)} 
                      style={{ 
                        backgroundColor: '#F59E0B', 
                        paddingHorizontal: 10, 
                        paddingVertical: 6, 
                        borderRadius: 6, 
                        marginLeft: 8 
                      }}
                    >
                      <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>↻ No listo</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {!!item.notas && <Text style={{ color: dark ? '#6EE7B7' : '#047857', marginTop: 4 }}>📝 {item.notas}</Text>}
              </View>
            );
          }}
          ListEmptyComponent={() => (
            <View style={{ padding: 24 }}>
                <Text style={{ textAlign: 'center', color: muted }}>No hay pedidos recientes</Text>
              </View>
          )}
        />
      )}

      {/* Modal de nota tipo notepad */}
      <Modal
        visible={notaModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotaModal({ visible: false, nota: '' })}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ 
            backgroundColor: '#FEF3C7', 
            borderRadius: 12, 
            padding: 20, 
            width: '90%', 
            maxWidth: 400,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 5,
          }}>
            {/* Header tipo notepad */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, borderBottomWidth: 2, borderBottomColor: '#F59E0B', paddingBottom: 8 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: '#78350F', flex: 1 }}>📝 Nota del Pedido</Text>
              <TouchableOpacity 
                onPress={() => setNotaModal({ visible: false, nota: '' })}
                style={{ padding: 4 }}
              >
                <Text style={{ fontSize: 24, color: '#78350F', fontWeight: '700' }}>×</Text>
              </TouchableOpacity>
            </View>
            
            {/* Contenido de la nota */}
            <View style={{ 
              backgroundColor: '#FFFBEB', 
              borderRadius: 8, 
              padding: 16, 
              minHeight: 100,
              borderWidth: 1,
              borderColor: '#FCD34D',
            }}>
              <Text style={{ fontSize: 16, color: '#78350F', lineHeight: 24 }}>{notaModal.nota}</Text>
            </View>
            
            {/* Botón cerrar */}
            <TouchableOpacity 
              onPress={() => setNotaModal({ visible: false, nota: '' })}
              style={{ 
                marginTop: 16, 
                backgroundColor: '#F59E0B', 
                padding: 12, 
                borderRadius: 8, 
                alignItems: 'center' 
              }}
            >
              <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de configuración */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: dark ? '#1F2937' : 'white', borderRadius: 12, padding: 20, width: '90%', maxWidth: 400 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: fg, marginBottom: 16, textAlign: 'center' }}>Configuración</Text>
            
            <Text style={{ color: fg, marginBottom: 8 }}>Nombre:</Text>
            <TextInput
              value={tempNombre}
              onChangeText={setTempNombre}
              style={{ borderWidth: 1, borderColor: dark ? '#4B5563' : '#D1D5DB', borderRadius: 8, padding: 12, marginBottom: 16, color: fg, backgroundColor: dark ? '#374151' : '#F9FAFB' }}
              placeholder="Ingresa tu nombre"
              placeholderTextColor={muted}
            />
            
            <Text style={{ color: fg, marginBottom: 8 }}>Foto de perfil:</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
              <TouchableOpacity onPress={pickImageFromLibrary} style={{ backgroundColor: '#3B82F6', padding: 12, borderRadius: 8, flex: 1, marginRight: 8, alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Subir foto</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={pickImageFromCamera} style={{ backgroundColor: '#10B981', padding: 12, borderRadius: 8, flex: 1, marginLeft: 8, alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Tomar foto</Text>
              </TouchableOpacity>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 16, gap: 12 }}>
              <TouchableOpacity onPress={() => setTheme('dark')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: dark ? '#1E3A8A' : 'transparent', alignItems: 'center', justifyContent: 'center', borderWidth: dark ? 0 : 1, borderColor: dark ? 'transparent' : (dark ? '#374151' : '#E5E7EB') }}>
                <Text style={{ fontSize: 18 }}>🌙</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setTheme('light')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: !dark ? '#FDE68A' : 'transparent', alignItems: 'center', justifyContent: 'center', borderWidth: !dark ? 0 : 1, borderColor: dark ? '#374151' : '#E5E7EB' }}>
                <Text style={{ fontSize: 18 }}>☀️</Text>
              </TouchableOpacity>
            </View>
            
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <TouchableOpacity onPress={() => { updateUser({ nombre: tempNombre }); setShowModal(false); }} style={{ backgroundColor: '#22c55e', padding: 12, borderRadius: 8, flex: 1, marginRight: 8, alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Guardar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { logout(); setShowModal(false); router.replace('/login'); }} style={{ backgroundColor: '#EF4444', padding: 12, borderRadius: 8, flex: 1, marginLeft: 8, alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Cerrar sesión</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Fixed footer — powered by */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: footerHeight, paddingVertical: 8, borderTopWidth: 1, borderColor: dark ? '#111827' : '#E5E7EB', backgroundColor: dark ? '#0b0f13' : '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: muted, marginRight: 8 }}>powered by</Text>
          {dark ? (
            darkFooterLogo ? <Image source={darkFooterLogo} style={{ width: Math.round(window.width * 0.36), height: Math.round(footerHeight * 0.5), resizeMode: 'contain' }} /> : <Text style={{ color: muted }}>SNT</Text>
          ) : (
            lightFooterLogo ? <Image source={lightFooterLogo} style={{ width: Math.round(window.width * 0.36), height: Math.round(footerHeight * 0.5), resizeMode: 'contain' }} /> : <Text style={{ color: muted }}>SNT</Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
