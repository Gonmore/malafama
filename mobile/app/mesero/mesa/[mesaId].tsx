import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, FlatList, SafeAreaView, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { comandaService, Comanda } from '../../../src/services/comanda';
import { useThemeStore } from '../../../src/store/theme';
import { productoService, Producto } from '../../../src/services/producto';

type Cantidades = Record<number, number>;

export default function MesaProductos() {
  const { mesaId } = useLocalSearchParams<{ mesaId: string }>();
  const [comanda, setComanda] = useState<Comanda | null>(null);
  const [productos, setProductos] = useState<Record<string, Producto[]>>({});
  const [cant, setCant] = useState<Cantidades>({});
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const id = typeof mesaId === 'string' ? parseInt(mesaId, 10) : Number(mesaId);

  const cargarComanda = async () => {
    if (isNaN(id)) {
      Alert.alert('Error', 'ID de mesa inválido');
      router.back();
      return null;
    }
    // Intentar obtener comanda abierta por mesa; si no hay, crear una.
    const data = await comandaService.getByMesa(id);
    const lista: Comanda[] = Array.isArray(data) ? data : data?.comandas || [];
    const abierta = lista.find((c) => c.estado === 'abierta') || lista[0];
    if (abierta) {
      setComanda(abierta);
      return abierta;
    }
    const creada = await comandaService.create({ mesaId: id });
    setComanda(creada);
    return creada;
  };

  const agrupar = (arr: Producto[]) => {
    return arr.reduce((acc: Record<string, Producto[]>, p) => {
      const cat = (p.categoria || 'Otros') as string;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {});
  };

  const cargarProductos = async () => {
    try {
      const ag = await productoService.getAgrupados();
      if (ag && typeof ag === 'object' && !Array.isArray(ag)) {
        setProductos(ag as any);
        return;
      }
      const all = await productoService.getAll();
      const list: Producto[] = Array.isArray(all) ? all : all?.productos || [];
      setProductos(agrupar(list));
    } catch (e) {
      // fallback silencioso
      setProductos({});
    }
  };

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await cargarComanda();
        await cargarProductos();
      } catch (e) {
        Alert.alert('Mesero', 'No se pudo preparar la comanda');
      } finally {
        setLoading(false);
      }
    })();
  }, [mesaId]);

  const inc = (id: number) => setCant((c) => ({ ...c, [id]: (c[id] || 0) + 1 }));
  const dec = (id: number) =>
    setCant((c) => ({ ...c, [id]: Math.max(0, (c[id] || 0) - 1) }));

  const totalItems = useMemo(() => Object.values(cant).reduce((a, b) => a + (b || 0), 0), [cant]);

  const enviar = async () => {
    if (!comanda) return;
    const pedidos = Object.entries(cant)
      .filter(([, q]) => (q || 0) > 0)
      .map(([pid, q]) => ({ productoId: Number(pid), cantidad: Number(q) }));
    if (pedidos.length === 0) {
      Alert.alert('Pedidos', 'Selecciona al menos un producto');
      return;
    }
    try {
      setLoading(true);
      await comandaService.addPedidos(comanda.id, pedidos);
      Alert.alert('Pedidos', 'Enviados a cocina');
      router.back();
    } catch (e: any) {
      const msg = e?.response?.data?.message || 'No se pudieron enviar';
      Alert.alert('Pedidos', msg);
    } finally {
      setLoading(false);
    }
  };

  const categorias = Object.keys(productos);

  const theme = useThemeStore((s) => s.theme);
  const dark = theme === 'dark';
  const bg = dark ? '#111827' : 'white';
  const fg = dark ? 'white' : '#111827';
  const muted = dark ? '#9CA3AF' : '#6B7280';

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

      <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: dark ? '#1F2937' : '#E5E7EB' }}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: fg }}>Mesa {mesaId} — Productos</Text>
        <Text style={{ color: muted, marginTop: 4 }}>Comanda #{comanda?.id || '…'}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 12 }}>
        {categorias.length === 0 && (
          <View style={{ padding: 24 }}>
            <Text style={{ textAlign: 'center', color: muted }}>{loading ? 'Cargando…' : 'Sin productos'}</Text>
          </View>
        )}
        {categorias.map((cat) => (
          <View key={cat} style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: fg, marginBottom: 8 }}>{cat}</Text>
            {productos[cat].map((p) => (
              <View
                key={p.id}
                style={{
                  borderWidth: 1,
                  borderColor: dark ? '#1F2937' : '#E5E7EB',
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 8,
                  backgroundColor: dark ? '#0b1220' : '#F9FAFB',
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ fontWeight: '700', color: fg }}>{p.nombre}</Text>
                    {p.precio != null && (
                      <Text style={{ color: muted, marginTop: 2 }}>
                        Bs {Number(p.precio).toFixed(2)}
                      </Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={() => dec(p.id)} style={{ padding: 8 }}>
                      <Text style={{ fontSize: 20, color: '#ef4444' }}>−</Text>
                    </TouchableOpacity>
                    <Text style={{ minWidth: 28, textAlign: 'center', fontWeight: '700', color: fg }}>{cant[p.id] || 0}</Text>
                    <TouchableOpacity onPress={() => inc(p.id)} style={{ padding: 8 }}>
                      <Text style={{ fontSize: 20, color: '#22c55e' }}>＋</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
      <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: dark ? '#1F2937' : '#E5E7EB' }}>
        <TouchableOpacity
          disabled={loading || totalItems === 0}
          onPress={enviar}
          style={{ backgroundColor: totalItems === 0 ? '#D1D5DB' : '#0ea5e9', padding: 14, borderRadius: 10 }}
        >
          <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>
            {loading ? 'Enviando…' : `Enviar a Cocina (${totalItems})`}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
