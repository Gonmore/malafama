import { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, SafeAreaView, Text, TouchableOpacity, View, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { pedidoService, Pedido } from '../../src/services/pedido';
import { formatTimeShort } from '../../src/utils/time';
import { useThemeStore } from '../../src/store/theme';
import { getSocket } from '../../src/services/socket';
import { notifySuccess } from '../../src/utils/notify';
import { useAuthStore } from '../../src/store/auth';
import { localService } from '../../src/services/local';

type Mode = 'por-pedido' | 'por-pedido-compacto' | 'por-producto' | 'por-producto-compacto' | 'por-mesa';
type Tab = 'cola' | 'recientes';

export default function BarDashboard() {
  const { user } = useAuthStore();
  const [localId, setLocalId] = useState<number | null>(user?.localId ?? null);
  const theme = useThemeStore((s) => s.theme);
  const dark = theme === 'dark';
  const bg = dark ? '#111827' : 'white';
  const fg = dark ? 'white' : '#111827';
  const muted = dark ? '#9CA3AF' : '#6B7280';
  const [items, setItems] = useState<Pedido[]>([]);
  const [recents, setRecents] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>('por-pedido-compacto');
  const [tab, setTab] = useState<Tab>('cola');

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
    load();
  }, [localId]);

  useEffect(() => {
    const s = getSocket();
    const onConnect = () => {
      // Join generic role room and local-scoped room if available
      s?.emit('join-room', 'bar');
      if (localId) s?.emit('join-room', `bar:${localId}`);
    };
    const onNew = async () => {
      await notifySuccess();
      load();
    };
    s?.on('connect', onConnect);
    s?.on('nuevo-pedido-bar', onNew);
    s?.on('nueva-comanda', onNew);
    s?.on('nuevos-pedidos', onNew);
    s?.on('pedido-cancelado', onNew);
    return () => {
      s?.off('connect', onConnect);
      s?.off('nuevo-pedido-bar', onNew);
      s?.off('nueva-comanda', onNew);
      s?.off('nuevos-pedidos', onNew);
      s?.off('pedido-cancelado', onNew);
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

  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      {/* Botón de retroceso */}
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

      <View style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: fg }}>Bar — Pendientes</Text>
          <TouchableOpacity onPress={load} disabled={loading} style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
            <Text style={{ color: '#0ea5e9' }}>{loading ? 'Cargando…' : 'Actualizar'}</Text>
          </TouchableOpacity>
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
        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          {([
            { key: 'por-pedido-compacto', label: 'Por pedido · compacto' },
            { key: 'por-producto-compacto', label: 'Por producto · compacto' },
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
                backgroundColor: mode === b.key ? (dark ? '#0b1220' : '#DBEAFE') : (dark ? '#0b1220' : '#F3F4F6'),
                borderWidth: 1,
                borderColor: mode === b.key ? '#60A5FA' : (dark ? '#1F2937' : '#E5E7EB'),
              }}
            >
              <Text style={{ color: mode === b.key ? '#1D4ED8' : (dark ? '#D1D5DB' : '#374151'), fontWeight: '600' }}>{b.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
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
          {Array.from(groupByProducto.entries()).map(([producto, pedidos]) => (
            <View key={producto} style={{ marginBottom: 16, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: dark ? '#1F2937' : '#E5E7EB' }}>
              <View style={{ backgroundColor: dark ? '#111827' : '#3B82F6', paddingHorizontal: 12, paddingVertical: 8 }}>
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>{producto}</Text>
                <Text style={{ color: dark ? '#D1D5DB' : '#DBEAFE' }}>{pedidos.length} pendiente(s)</Text>
              </View>
              {mode === 'por-producto-compacto' ? (
                <ScrollView horizontal contentContainerStyle={{ padding: 12 }} showsHorizontalScrollIndicator={false}>
                  {pedidos.map((p) => (
                    <View
                      key={p.id}
                      style={{
                        width: 120,
                        backgroundColor: dark ? '#0b1220' : '#F9FAFB',
                        borderColor: dark ? '#1F2937' : '#E5E7EB',
                        borderWidth: 1,
                        borderRadius: 10,
                        padding: 10,
                        marginRight: 8,
                      }}
                    >
                        <Text style={{ fontWeight: '700', color: fg, textAlign: 'center' }}>x{p.cantidad}</Text>
                          <Text style={{ color: dark ? '#D1D5DB' : '#374151', textAlign: 'center', marginTop: 2 }}>Mesa {p?.comanda?.mesa?.numero ?? p?.comanda?.mesa?.nombre ?? '—'}</Text>
                          <Text style={{ color: muted, textAlign: 'center', marginTop: 2 }}>{formatTimeShort(p?.createdAt || p?.created_at)}</Text>
                      <TouchableOpacity onPress={() => marcarListo(p.id)} style={{ marginTop: 8, backgroundColor: '#22c55e', paddingVertical: 8, borderRadius: 999 }}>
                        <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>✓</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              ) : (
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
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ fontWeight: '700', color: fg }}>x{p.cantidad}</Text>
                        <Text style={{ color: dark ? '#D1D5DB' : '#374151' }}>Mesa {p?.comanda?.mesa?.numero ?? p?.comanda?.mesa?.nombre ?? '—'}</Text>
                      </View>
                      {!!p.notas && <Text style={{ color: muted, marginTop: 4 }}>📝 {p.notas}</Text>}
                      <TouchableOpacity onPress={() => marcarListo(p.id)} style={{ marginTop: 8, backgroundColor: '#22c55e', padding: 8, borderRadius: 8 }}>
                        <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>Listo</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
          {items.length === 0 && (
            <View style={{ padding: 24 }}>
              <Text style={{ textAlign: 'center', color: muted }}>No hay pedidos pendientes</Text>
            </View>
          )}
        </ScrollView>
      )}

      {tab === 'cola' && mode === 'por-mesa' && (
        <ScrollView contentContainerStyle={{ padding: 12 }}>
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
          contentContainerStyle={{ padding: 12 }}
          data={recents}
          keyExtractor={(p) => String(p.id)}
          renderItem={({ item }) => (
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
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontWeight: '700', color: '#065F46' }}>
                  ✓ {item.cantidad}× {item.producto?.nombre || 'Producto'} — Mesa {item?.comanda?.mesa?.numero ?? item?.comanda?.mesa?.nombre ?? '—'}
                </Text>
              </View>
              {!!item.notas && <Text style={{ color: dark ? '#6EE7B7' : '#047857', marginTop: 4 }}>📝 {item.notas}</Text>}
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={{ padding: 24 }}>
                <Text style={{ textAlign: 'center', color: muted }}>No hay pedidos recientes</Text>
              </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
