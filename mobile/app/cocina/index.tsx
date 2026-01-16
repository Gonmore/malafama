import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Text, TouchableOpacity, View, ScrollView, Image, Dimensions, Modal, TextInput, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import TopNav from '../components/TopNav';
import { pedidoService, Pedido } from '../../src/services/pedido';
import { productoService, Producto } from '../../src/services/producto';
import { formatTimeShort, getMinutosTranscurridos } from '../../src/utils/time';
import { useThemeStore } from '../../src/store/theme';
import { PRIMARY, SECONDARY_BLUE, SECONDARY_BLUE_DARK } from '../../src/constants/colors';
import { getSocket } from '../../src/services/socket';
import { notifySuccess } from '../../src/utils/notify';
import { useAuthStore } from '../../src/store/auth';
import { localService } from '../../src/services/local';
import * as ImagePicker from 'expo-image-picker';
import AccountModal from '../components/AccountModal';
import { showErrorAlert } from '../../src/utils/errorHandler';

type Mode = 'por-pedido' | 'por-pedido-compacto' | 'por-producto' | 'por-producto-compacto';
type Tab = 'cola' | 'recientes';

export default function CocinaDashboard() {
  const { user } = useAuthStore();
  const logout = useAuthStore((s) => s.logout);
  const updateUser = useAuthStore((s) => s.updateUser);
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
  const [showModal, setShowModal] = useState(false);
  const [tempNombre, setTempNombre] = useState(user?.nombre || '');
  const [localLogo, setLocalLogo] = useState<string | null>(null);
  const [localId, setLocalId] = useState<number | null>(user?.localId ?? null);
  const [productFilterOpen, setProductFilterOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [catalogProducts, setCatalogProducts] = useState<Producto[]>([]);
  const window = Dimensions.get('window');
  const footerHeight = Math.max(56, Math.round(window.height * 0.072));
  const [items, setItems] = useState<Pedido[]>([]);
  const [recents, setRecents] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('por-producto-compacto');
  const [tab, setTab] = useState<Tab>('cola');
  const [notaModal, setNotaModal] = useState<{ visible: boolean; nota: string }>({ visible: false, nota: '' });

  const load = async () => {
      try {
      setLoading(true);
      const data = await pedidoService.getPendientesCocina({ tipo: 'comida', localId: localId ?? undefined });
        // payload returned by API processed below
      setItems(Array.isArray(data) ? data : data?.data || data?.pedidos || []);
      const r = await pedidoService.getRecientes({ tipo: 'comida', localId: localId ?? undefined });
      setRecents(Array.isArray(r) ? r : r?.data || r?.pedidos || []);
    } catch (e) {
      Alert.alert('Cocina', 'No se pudo cargar la cola');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // ensure we have a localId before loading pedidos / catalog
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
        } catch (e) {
          // ignore — we'll continue without a localId
        }
      }
    };

    (async () => {
      await ensureLocal();
      await load();
    })();

    const loadLocalLogo = async () => {
      if (user?.localId) {
        try {
          const logo = await localService.obtenerLogoLocal();
          if (logo) setLocalLogo(logo);
        } catch (e) {
          console.error('Error loading local logo', e);
        }
      }
      return null;
    };
    loadLocalLogo();

    // Restore persisted product filter for this user
    (async () => {
      try {
        const key = `cocina_prod_filter_${user?.id || 'anon'}`;
        const raw = await AsyncStorage.getItem(key);
        if (raw) setSelectedProducts(new Set(JSON.parse(raw) as string[]));
      } catch {}
    })();

    // Conectar al socket para actualizaciones en tiempo real
    const socket = getSocket();
    if (socket) {
      socket.emit('join-room', 'cocina');
      if (localId) socket.emit('join-room', `cocina:${localId}`);
    }
    const onNew = async () => {
      await notifySuccess();
      load();
    };
    socket?.on('nueva-comanda', onNew);
    socket?.on('nuevos-pedidos', onNew);
    socket?.on('pedido-cancelado', onNew);
    return () => {
      socket?.off('nueva-comanda', onNew);
      socket?.off('nuevos-pedidos', onNew);
      socket?.off('pedido-cancelado', onNew);
    };
  }, [localId]);

  const allByProducto = useMemo(() => {
    const map = new Map<string, Pedido[]>();
    for (const p of items) {
      const key = p?.producto?.nombre || 'Sin nombre';
      const arr = map.get(key) || [];
      arr.push(p);
      map.set(key, arr);
    }
    return map;
  }, [items]);

  const groupByProducto = useMemo(() => {
    const map = new Map(allByProducto);
    if (selectedProducts && selectedProducts.size > 0) {
      const filtered = new Map<string, Pedido[]>();
      for (const [name, arr] of map.entries()) {
        const sample = arr[0];
        const prodKey = `prod:${sample?.producto?.id ?? sample?.producto?.nombre}`;
        if (selectedProducts.has(prodKey)) filtered.set(name, arr);
      }
      return filtered;
    }
    return map;
  }, [allByProducto, selectedProducts]);

  // toggle product selection helper (accept Pedido or Producto)
  const toggleProductSelection = (p: Pedido | Producto) => {
    try {
      const product = (p as any)?.producto ? (p as any).producto : (p as any);
      const key = `prod:${product?.id ?? product?.nombre}`;
      setSelectedProducts((prev) => {
        const copy = new Set(prev);
        if (copy.has(key)) copy.delete(key); else copy.add(key);
        return copy;
      });
    } catch {}
  };

  const persistProductFilter = async () => {
    try {
      const key = `cocina_prod_filter_${user?.id || 'anon'}`;
      await AsyncStorage.setItem(key, JSON.stringify(Array.from(selectedProducts)));
    } catch (e) {}
  };

  // Fetch product catalog (comidas) for the filter modal
  useEffect(() => {
    let cancelled = false;
    const loadProducts = async () => {
      try {
        const res = await productoService.getAll({ localId: localId ?? undefined });
        const arr = Array.isArray(res) ? res : (res?.data || res?.productos || []);
        if (cancelled) return;
        // Filter for comidas using heuristic: not bebidas
        const isBebida = (prod?: any) => {
          if (!prod) return false;
          const tipo = (prod.tipo || prod?.type || prod?.categoria || '')?.toString().toLowerCase();
          return tipo.includes('beb') || tipo.includes('drink') || tipo.includes('beverage');
        };
        setCatalogProducts(arr.filter(p => !isBebida(p)));
      } catch (e) {
        // ignore failures; modal will fallback to allByProducto
      }
    };
    loadProducts();
    return () => { cancelled = true; };
  }, [localId]);

  const marcarListo = async (id: number) => {
    try {
      await pedidoService.marcarListo(id);
      load();
    } catch (e) {
      showErrorAlert(e, {
        title: 'Pedido',
        onRetry: () => marcarListo(id)
      });
    }
  };

  const desmarcarListo = async (id: number) => {
    try {
      await pedidoService.desmarcarListo(id);
      load();
    } catch (e) {
      showErrorAlert(e, {
        title: 'Pedido',
        onRetry: () => desmarcarListo(id)
      });
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
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      {/* Top nav (centralized logo handling + logout) */}
      <TopNav title="Cocina" localLogo={localLogo} onOpenSettings={() => setShowModal(true)} />

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
        {/* Tabs: Cola | Recientes */}
        <View style={{ flexDirection: 'row', marginTop: 0 }}>
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
              <Text style={{ color: tab === t.key ? '#2563EB' : '#6B7280', fontWeight: '700' }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          {([
            { key: 'por-producto-compacto', label: 'Por producto · compacto' },
            { key: 'por-pedido-compacto', label: 'Por pedido · compacto' },
            { key: 'por-producto', label: 'Por producto' },
          ] as { key: Mode; label: string }[]).map((b) => (
            <TouchableOpacity
              key={b.key}
              onPress={async () => {
                setMode(b.key);
                try {
                  await AsyncStorage.setItem('cocina_modo_vista', b.key);
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
        {/* Filter toggle button */}
        <View style={{ position: 'absolute', right: 16, top: 20, zIndex: 12 }}>
          <TouchableOpacity onPress={() => setProductFilterOpen(true)} style={{ padding: 8, borderRadius: 8, backgroundColor: dark ? '#111827' : '#F3F4F6', borderWidth: 1, borderColor: dark ? '#374151' : '#E5E7EB' }}>
            <Text style={{ color: dark ? '#D1D5DB' : '#374151', fontWeight: '700' }}>Filtrar</Text>
          </TouchableOpacity>
        </View>
        {/* product filter modal */}
        <Modal visible={productFilterOpen} transparent animationType="fade" onRequestClose={() => setProductFilterOpen(false)}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <View style={{ width: '100%', maxWidth: 520, backgroundColor: dark ? '#0b1220' : '#FFFFFF', borderRadius: 12, padding: 12 }}>
              <Text style={{ fontWeight: '700', fontSize: 18, marginBottom: 8 }}>Filtrar por productos</Text>
              <ScrollView style={{ maxHeight: 320 }}>
                {Array.from(catalogProducts && catalogProducts.length
                  ? new Map(catalogProducts.map((prod) => {
                      const name = prod.nombre || prod.categoria || prod.tipo || String(prod.id || '');
                      const count = items.filter(i => (i.producto?.id && prod.id ? String(i.producto.id) === String(prod.id) : (i.producto?.nombre || '') === (prod.nombre || ''))).length;
                      return [name, { prod, count }];
                    }))
                  : groupByProducto.entries()).map(([producto, val]) => {
                    if (Array.isArray(val)) {
                      const pedidos = val as Pedido[];
                      const sample = pedidos[0];
                      const key = `prod:${sample?.producto?.id ?? sample?.producto?.nombre}`;
                      return (
                        <TouchableOpacity key={key} onPress={() => toggleProductSelection(sample)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                          <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: selectedProducts.has(key) ? PRIMARY : (dark ? '#374151' : '#E5E7EB'), backgroundColor: selectedProducts.has(key) ? PRIMARY : 'transparent', marginRight: 12 }} />
                          <Text style={{ color: fg, flex: 1 }}>{producto} <Text style={{ color: muted }}>({pedidos.length})</Text></Text>
                        </TouchableOpacity>
                      );
                    }
                    const entry = val as { prod: Producto; count: number };
                    const prod = entry?.prod;
                    const count = entry?.count ?? 0;
                    const key = `prod:${prod?.id ?? prod?.nombre}`;
                    return (
                      <TouchableOpacity key={key} onPress={() => toggleProductSelection(prod)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                        <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: selectedProducts.has(key) ? PRIMARY : (dark ? '#374151' : '#E5E7EB'), backgroundColor: selectedProducts.has(key) ? PRIMARY : 'transparent', marginRight: 12 }} />
                        <Text style={{ color: fg, flex: 1 }}>{producto} <Text style={{ color: muted }}>({count})</Text></Text>
                      </TouchableOpacity>
                    );
                })}
              </ScrollView>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
                <TouchableOpacity onPress={() => { setSelectedProducts(new Set()); }} style={{ padding: 10, marginRight: 8 }}><Text style={{ color: muted }}>Limpiar</Text></TouchableOpacity>
                <TouchableOpacity onPress={async () => { await persistProductFilter(); setProductFilterOpen(false); }} style={{ padding: 10, backgroundColor: PRIMARY, borderRadius: 8 }}><Text style={{ color: 'white' }}>Aplicar</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>

      {(tab === 'cola' && (mode === 'por-pedido' || mode === 'por-pedido-compacto')) && (
        <FlatList
          contentContainerStyle={{ padding: 12, paddingBottom: footerHeight + 32 }}
          data={items}
          keyExtractor={(p) => String(p.id)}
          renderItem={({ item }) => (
            <View
              style={{
                backgroundColor: dark ? '#1F2937' : '#F9FAFB',
                borderColor: dark ? '#374151' : '#E5E7EB',
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
                {!!item.notas && mode !== 'por-pedido-compacto' && (
                  <Text style={{ color: muted, marginTop: 4 }}>📝 {item.notas}</Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => marcarListo(item.id)}
                style={{
                  marginTop: mode === 'por-pedido-compacto' ? 0 : 8,
                  backgroundColor: '#22c55e',
                  padding: 10,
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
        <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: footerHeight + 32 }}>
          {Array.from(groupByProducto.entries()).map(([producto, pedidos]) => {
            // Ordenar por antigüedad (más antiguos primero)
            const pedidosOrdenados = pedidos.sort((a, b) => {
              const timeA = new Date(a?.createdAt || a?.created_at || 0).getTime();
              const timeB = new Date(b?.createdAt || b?.created_at || 0).getTime();
              return timeA - timeB;
            });
            return (
              <View key={producto} style={{ marginBottom: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' }}>
                <View style={{ backgroundColor: '#111827', paddingHorizontal: 12, paddingVertical: 4, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>{producto}</Text>
                  <Text style={{ color: '#D1D5DB', fontSize: 13 }}>{pedidos.length} pendiente(s)</Text>
                </View>
                {mode === 'por-producto' ? (
                  <ScrollView horizontal contentContainerStyle={{ paddingHorizontal: 6, paddingVertical: 0, paddingBottom: 0 }} showsHorizontalScrollIndicator={false}>
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
                            backgroundColor: esListo ? '#E5E7EB' : (dark ? SECONDARY_BLUE_DARK : SECONDARY_BLUE),
                            borderColor: esListo ? '#9CA3AF' : (dark ? '#475569' : '#D1D5DB'),
                            borderWidth: 1.5,
                            borderRadius: 8,
                            padding: 4,
                            marginRight: 6,
                            opacity: esListo ? 0.6 : 1,
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
                            <Text style={{ color: esListo ? '#9CA3AF' : (dark ? '#D1D5DB' : muted), textAlign: 'center', marginTop: 2, fontSize: 11 }}>Mesa {p?.comanda?.mesa?.numero ?? p?.comanda?.mesa?.nombre ?? '—'}</Text>
                            <Text style={{ color: colorTiempo, textAlign: 'center', marginTop: 2, fontSize: 12, fontWeight: '600' }}>{minutos} min</Text>
                            {!esListo ? (
                              <TouchableOpacity onPress={() => marcarListo(p.id)} style={{ marginTop: 4, backgroundColor: '#22c55e', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 }}>
                                <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700', fontSize: 14 }}>✓</Text>
                              </TouchableOpacity>
                            ) : puedeDesmarcar ? (
                              <TouchableOpacity onPress={() => desmarcarListo(p.id)} style={{ marginTop: 4, backgroundColor: '#F59E0B', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999 }}>
                                <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700', fontSize: 14 }}>↻</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <ScrollView horizontal contentContainerStyle={{ paddingHorizontal: 4, paddingVertical: 0, paddingBottom: 0 }} showsHorizontalScrollIndicator={false}>
                    {pedidosOrdenados.map((p) => {
                      const minutos = getMinutosTranscurridos(p?.createdAt || p?.created_at);
                      const esListo = p?.estado === 'listo';
                      const puedeDesmarcar = esListo && minutos <= 5;
                      const colorTiempo = esListo ? '#9CA3AF' : minutos <= 5 ? '#10B981' : minutos <= 8 ? '#F59E0B' : '#EF4444';
                      return (
                        <View
                          key={p.id}
                          style={{
                            backgroundColor: esListo ? '#E5E7EB' : (dark ? SECONDARY_BLUE_DARK : SECONDARY_BLUE),
                            borderColor: esListo ? '#9CA3AF' : (dark ? '#374151' : '#E5E7EB'),
                            borderWidth: 1,
                            borderRadius: 8,
                            paddingVertical: 4,
                            paddingLeft: 0,
                            paddingRight: 4,
                            marginRight: 4,
                            opacity: esListo ? 0.6 : 1,
                            minWidth: 96,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {/* Left: quantity (compact single text) */}
                              <View style={{ width: 18, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ fontSize: 14, color: esListo ? '#6B7280' : (dark ? '#F3F4F6' : fg) }}>
                                  <Text style={{ fontWeight: '400' }}>x</Text>
                                  <Text style={{ fontWeight: '700' }}>{p.cantidad}</Text>
                                </Text>
                              </View>

                            {/* Separator vertical */}
                            <View style={{ width: 1, height: 36, backgroundColor: dark ? '#374151' : '#E5E7EB', marginLeft: 3, marginRight: 1 }} />

                            {/* Center: mesa (top) and time (bottom) */}
                            <View style={{ flex: 1, justifyContent: 'center', paddingRight: 0, marginRight: 0, alignItems: 'flex-end' }}>
                              <Text style={{ fontWeight: '400', color: fg, fontSize: 11, textAlign: 'right' }}>Mesa {p?.comanda?.mesa?.numero ?? p?.comanda?.mesa?.nombre ?? '—'}</Text>
                              <Text style={{ color: colorTiempo, fontSize: 8, marginTop: 1, textAlign: 'right' }}>{getMinutosTranscurridos(p?.createdAt || p?.created_at)} min</Text>
                            </View>

                            {/* Separator vertical */}
                            <View style={{ width: 1, height: 36, backgroundColor: dark ? '#374151' : '#E5E7EB', marginLeft: 1, marginRight: 1 }} />

                            {/* Right: action button */}
                            <View style={{ width: 28, alignItems: 'center', justifyContent: 'center' }}>
                              <TouchableOpacity onPress={() => marcarListo(p.id)} style={{ backgroundColor: '#22c55e', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.22, shadowRadius: 1.2, elevation: 3 }}>
                                <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>✓</Text>
                              </TouchableOpacity>
                            </View>
                          </View>

                          {/* Note full width below */}
                          {p.notas ? (
                            <View style={{
                              marginTop: 2,
                              paddingVertical: 2,
                              paddingHorizontal: 6,
                              borderTopWidth: 1,
                              borderTopColor: dark ? '#374151' : '#E5E7EB',
                              backgroundColor: dark ? '#5C3D07' : '#FEF3C7',
                              borderRadius: 6,
                            }}>
                              <Text style={{ color: dark ? '#FFFBEB' : '#78350F', fontSize: 10 }}>{`📝 ${p.notas}`}</Text>
                            </View>
                          ) : null}
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
              <Text style={{ textAlign: 'center', color: '#6B7280' }}>No hay pedidos pendientes</Text>
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
                  backgroundColor: '#ECFDF5',
                  borderColor: '#10B981',
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
                    <Text style={{ color: '#047857', marginTop: 2, fontSize: 12 }}>
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
                {!!item.notas && <Text style={{ color: '#047857', marginTop: 4 }}>📝 {item.notas}</Text>}
              </View>
            );
          }}
          ListEmptyComponent={() => (
            <View style={{ padding: 24 }}>
              <Text style={{ textAlign: 'center', color: '#6B7280' }}>No hay pedidos recientes</Text>
            </View>
          )}
        />
      )}

      {/* account modal (shared) */}
      <AccountModal visible={showModal} onClose={() => setShowModal(false)} />

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
