import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, ScrollView, Text, TouchableOpacity, View, Modal, FlatList, Image, Dimensions, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { comandaService, Comanda } from '../../../src/services/comanda';
import { useAuthStore } from '../../../src/store/auth';
import { Animated } from 'react-native';
import { mesaService } from '../../../src/services/mesa';
import { useThemeStore } from '../../../src/store/theme';
import { PRIMARY, PRIMARY_TRANSPARENT } from '../../../src/constants/colors';
import { productoService, Producto } from '../../../src/services/producto';
import { getSocket } from '../../../src/services/socket';
import * as ImagePicker from 'expo-image-picker';
import { notifySuccess } from '../../../src/utils/notify';

const checkGif = require('../../../assets/check.gif');
const darkCheckGif = require('../../../assets/dark_check.gif');

type Cantidades = Record<string, number>;

const getEmojiPorTipo = (tipo?: string) => {
  if (!tipo) return '🍽️';
  const t = (tipo || '').toString().toLowerCase();
  if (/pizz/i.test(t)) return '🍕';
  if (t.includes('comida') || t.includes('food') || t.includes('dish')) return '🍔';
  if (t.includes('bebida') || t.includes('drink') || t.includes('bar')) return '🥤';
  return '🍽️';
};

export default function MesaProductos() {
  const { mesaId } = useLocalSearchParams<{ mesaId: string }>();
  const [comandas, setComandas] = useState<Comanda[]>([]);
  const [productos, setProductos] = useState<Record<string, Producto[]>>({});
  const [cant, setCant] = useState<Cantidades>({});
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('Todas');
  const [mostrarPedido, setMostrarPedido] = useState(false);
  const [selectedComanda, setSelectedComanda] = useState<any | null>(null);
  const [showComandaDetalle, setShowComandaDetalle] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pagoMetodo, setPagoMetodo] = useState<'efectivo' | 'qr' | 'mixto'>('efectivo');
  const [comprobanteImagen, setComprobanteImagen] = useState<string | null>(null);
  const [montoEfectivoPago, setMontoEfectivoPago] = useState<string>('');
  const [loadingPago, setLoadingPago] = useState(false);
  const [showSuccessGif, setShowSuccessGif] = useState(false);
  const [comprobanteEsRespaldo, setComprobanteEsRespaldo] = useState(false);
  const user = useAuthStore((s) => s.user);
  // Prefill comprobanteImagen with local QR when payment modal opens for QR or mixto

  const [comandaIndex, setComandaIndex] = useState<number | null>(null);
  // controls whether product selection grid is visible: null = hidden when a comanda exists
  // 'add' = adding products to existing comanda, 'new' = create a new comanda
  const [showProductsMode, setShowProductsMode] = useState<null | 'add' | 'new'>(null);

  // animated value to show/hide categories + products smoothly
  const [showProductsAnim] = useState(() => new Animated.Value(0));
  const [viewMode, setViewMode] = useState<'regular' | 'compact'>('regular');
  const [mesaInfo, setMesaInfo] = useState<{ numero?: number; nombre?: string } | null>(null);
  const router = useRouter();
  const theme = useThemeStore((s) => s.theme);
  const dark = theme === 'dark';
  const bg = dark ? '#111827' : 'white';
  const fg = dark ? 'white' : '#111827';
  const muted = dark ? '#9CA3AF' : '#6B7280';

  const id = typeof mesaId === 'string' ? mesaId : String(mesaId);
  console.log('[MesaProductos] mesaId recibido:', mesaId, 'tipo:', typeof mesaId);

  useEffect(() => {
    (async () => {
      try {
        if (showPaymentModal && (pagoMetodo === 'qr' || pagoMetodo === 'mixto')) {
          console.log('[QR] User object:', user);
          const qr = (user as any)?.local?.qr || (user as any)?.local?.data?.qr || null;
          console.log('[QR] QR found:', qr ? 'yes' : 'no');
          if (qr) {
            console.log('[QR] Setting comprobanteImagen');
            setComprobanteImagen(qr);
            setComprobanteEsRespaldo(false);
          } else {
            console.warn('[QR] No QR found in user.local');
          }
        }
      } catch (e) {
        console.error('Error loading QR:', e);
      }
    })();
  }, [showPaymentModal, pagoMetodo, user]);

  // caching footer images and sizing so footer is consistent across views
  let lightFooterLogo: any = null;
  let darkFooterLogo: any = null;
  try {
    lightFooterLogo = require('../../../assets/SNT_logo/Logo_Azul.png');
    darkFooterLogo = require('../../../assets/SNT_logo/Logo_Blanco.png');
  } catch (err) {
    // fallback to text
  }

  const window = Dimensions.get('window');
  const footerHeight = Math.max(56, Math.round(window.height * 0.072));

  // restore mesero view mode preference
  useEffect(() => {
    (async () => {
      try {
        const s = await AsyncStorage.getItem('mesero_modo_vista');
        if (s === 'compact' || s === 'regular') setViewMode(s);
        console.log('[MesaProductos] modo vista restaurado:', s);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    console.log('[MesaProductos] modo vista actual:', viewMode);
  }, [viewMode]);

  const isSameDay = (a?: string | Date | null) => {
    if (!a) return false;
    try {
      const d = new Date(a);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    } catch (err) {
      return false;
    }
  };

  const cargarComandas = async () => {
    try {
      const data = await comandaService.getByMesa(id);
      // comandaService may return multiple shapes depending on server / wrappers:
      // - an array directly
      // - { success: true, data: [...] }
      // - { comandas: [...] }
      let lista: Comanda[] = [];
      if (Array.isArray(data)) lista = data as Comanda[];
      else if (Array.isArray((data as any)?.data)) lista = (data as any).data;
      else if (Array.isArray((data as any)?.comandas)) lista = (data as any).comandas;

      // Mostrar comandas abiertas + las que están cerradas y entregadas del mismo día (solo informativas)
      // Usar updated_at para determinar si es del mismo día
      // Use consistent ordering with Mesero: newest comanda first
      const abiertas = (lista || []).slice().filter((c) => c.estado === 'abierta' || (c.estado === 'cerrada' && c.entregado === true && isSameDay((c as any).updated_at || (c as any).cerradaAt || (c as any).cerrada_at))).sort((a: any, b: any) => {
        const A = new Date(a.createdAt || a.created_at || 0).getTime() || 0;
        const B = new Date(b.createdAt || b.created_at || 0).getTime() || 0;
        return B - A;
      });
      // Debug: print comandas loaded for this mesa so we can match which id is entregada
      try { console.log('[MesaProductos] cargarComandas -> mesaId:', id, 'comandas loaded:', (lista || []).map(c => ({ id: c.id, estado: c.estado, entregado: c.entregado }))); } catch (err) {}
      setComandas(abiertas);
      
      // Obtener info de la mesa desde la primera comanda
      if (lista.length > 0 && lista[0].mesa) {
        setMesaInfo({ numero: lista[0].mesa.numero, nombre: lista[0].mesa.nombre });
      }
    } catch (e) {
      console.error('Error cargando comandas:', e);
      setComandas([]);
    }
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
      console.log('[MesaProductos] Cargando productos...');
      const ag = await productoService.getAgrupados();
      console.log('[MesaProductos] Respuesta agrupados:', JSON.stringify(ag).substring(0, 200));
      
      // Si viene { success: true, data: [...] } donde data es array de { categoria, productos }
      if (ag?.success && Array.isArray(ag.data)) {
        console.log('[MesaProductos] Transformando array de categorías');
        const agrupado: Record<string, Producto[]> = {};
        ag.data.forEach((item: any) => {
          if (item.categoria && Array.isArray(item.productos)) {
            agrupado[item.categoria] = item.productos;
          }
        });
        console.log('[MesaProductos] Categorías transformadas:', Object.keys(agrupado));
        setProductos(agrupado);
        return;
      }
      
      // Si viene directamente como objeto agrupado { categoria1: [...], categoria2: [...] }
      if (ag && typeof ag === 'object' && !Array.isArray(ag) && !ag.success) {
        console.log('[MesaProductos] Usando ag directo como objeto');
        setProductos(ag as any);
        return;
      }
      
      console.log('[MesaProductos] Agrupados falló, intentando getAll');
      const all = await productoService.getAll();
      console.log('[MesaProductos] Respuesta getAll:', JSON.stringify(all).substring(0, 200));
      const list: Producto[] = Array.isArray(all) ? all : all?.productos || all?.data || [];
      console.log('[MesaProductos] Total productos:', list.length);
      setProductos(agrupar(list));
    } catch (e) {
      console.error('[MesaProductos] Error cargando productos:', e);
      setProductos({});
    }
  };

  useEffect(() => {
    if (!id || id === 'undefined') {
      Alert.alert('Error', 'ID de mesa inválido');
      router.back();
      return;
    }
    console.log('[MesaProductos] Cargando mesa con id:', id);

    (async () => {
      try {
        setLoading(true);
        
        // Cargar info de la mesa
        try {
          const mesaData = await mesaService.getById(id);
          // backend may return: { success: true, data: {...} }, or { mesa: {...} }, or direct object
          if (mesaData?.mesa) {
            setMesaInfo({ numero: mesaData.mesa.numero, nombre: mesaData.mesa.nombre });
          } else if (mesaData?.data) {
            setMesaInfo({ numero: mesaData.data.numero, nombre: mesaData.data.nombre });
          } else if (mesaData) {
            setMesaInfo({ numero: mesaData.numero, nombre: mesaData.nombre });
          }
        } catch (err) {
          console.warn('No se pudo cargar info de mesa:', err);
        }
        
        await cargarComandas();
        await cargarProductos();
      } catch (e) {
        Alert.alert('Mesero', 'No se pudo cargar la información');
      } finally {
        setLoading(false);
      }
    })();

    const socket = getSocket();
    if (socket) {
      socket.on('comanda-actualizada', () => { cargarComandas(); });
      socket.on('pedido-listo', () => { cargarComandas(); });
      return () => {
        socket.off('comanda-actualizada');
        socket.off('pedido-listo');
      };
    }
  }, [mesaId]);

  const resetCantidades = () => {
    setCant({});
    setNotas({});
  };
  const inc = (id: string | number) => setCant((c) => {
    const key = String(id);
    return { ...c, [key]: (c[key] || 0) + 1 };
  });
  const eliminar = (id: string | number) => {
    setCant((c) => {
      const newCant = { ...c } as Cantidades;
      delete newCant[String(id)];
      return newCant;
    });
  };

  // Compute total items directly — no intermediate variables to avoid cache issues
  const totalItems = useMemo(() => Object.values(cant).reduce((a, b) => a + (b || 0), 0), [cant]);

  const totalPrecio = useMemo(() => {
    let total = 0;
    Object.entries(cant).forEach(([pid, cantidad]) => {
      if (cantidad > 0) {
        const allProductos = Object.values(productos).reduce((acc: Producto[], arr: Producto[]) => acc.concat(arr), []);
        const producto = allProductos.find((p: Producto) => String(p.id) === String(pid));
        if (producto?.precio) {
          total += Number(producto.precio) * cantidad;
        }
      }
    });
    return total;
  }, [cant, productos]);

  const productosFiltrados = useMemo(() => {
    if (categoriaSeleccionada === 'Todas') {
      return Object.values(productos).reduce((acc: Producto[], arr: Producto[]) => acc.concat(arr), []);
    }
    return productos[categoriaSeleccionada] || [];
  }, [productos, categoriaSeleccionada]);

  const enviar = async () => {
    let comandaId: string | number;
    // Determine whether we should create a new comanda or use an existing one:
    const shouldCreateNew = showProductsMode === 'new' || (!selectedComanda && comandas.length === 0);
    if (!shouldCreateNew) {
      if (selectedComanda && selectedComanda.id) {
        comandaId = selectedComanda.id;
      } else if (comandas.length > 0) {
        comandaId = comandas[0].id;
      }
    }

    // build pedidos now so we can create and add in a coherent flow
    const pedidos = Object.entries(cant).filter(([, q]) => (q || 0) > 0).map(([pid, q]) => ({ productoId: String(pid), cantidad: Number(q), notas: (notas[pid] || '').trim() }));
    if (pedidos.length === 0) {
      Alert.alert('Pedidos', 'Selecciona al menos un producto');
      return;
    }

    const doAddPedidos = async (targetComandaId: string | number) => {
      try {
        setLoading(true);
        await comandaService.addPedidos(targetComandaId, pedidos);
        try { notifySuccess(); } catch {}
        setShowSuccessGif(true);
        setTimeout(async () => {
          setShowSuccessGif(false);
          resetCantidades();
          setMostrarPedido(false);
          try { await cargarComandas(); } catch (err) { console.warn('Error recargando comandas tras enviar pedidos:', err); }
          try { router.replace('/mesero'); } catch (err) { console.warn('router.replace /mesero failed', err); }
          setShowProductsMode(null);
          setSelectedComanda(null);
          setComandaIndex(null);
        }, 3200);
      } catch (err: any) {
        const msg = err?.response?.data?.message || 'No se pudieron enviar';
        Alert.alert('Pedidos', msg);
      } finally {
        setLoading(false);
      }
    };

    if (shouldCreateNew) {
      try {
        // Si el usuario eligió explícitamente "Crear nueva comanda" (showProductsMode === 'new'), 
        // enviamos forzar: true para que el backend permita crear la comanda aunque ya exista una abierta
        const createOptions = showProductsMode === 'new' ? { forzar: true } : {};
        const nuevaComandaResp: any = await comandaService.create({ mesaId: id }, createOptions);
        // backend may return different shapes: direct object, { success: true, data: {...} }, or { data: {...} }
        let nuevaComandaObj = nuevaComandaResp;
        if (nuevaComandaResp?.data) nuevaComandaObj = nuevaComandaResp.data;
        if (nuevaComandaObj?.data) nuevaComandaObj = nuevaComandaObj.data;
        comandaId = nuevaComandaObj?.id;
        console.log('[MesaProductos] nuevaComanda response:', { nuevaComandaResp, resolvedId: comandaId });
        if (!comandaId) {
          Alert.alert('Error', 'No se pudo obtener el id de la comanda creada');
          return;
        }
        // add pedidos once created
        await doAddPedidos(comandaId);
        return;
      } catch (e: any) {
        // If backend replies 400 because an open comanda exists, offer to use it or force-create
        const resp = e?.response?.data;
        console.error('[MesaProductos] error creando comanda:', e?.response?.status, resp);
        if (e?.response?.status === 400 && resp?.comandaExistente) {
          Alert.alert(
            'Ya existe una comanda',
            `Ya existe una comanda abierta (id: ${resp.comandaExistente}). ¿Deseas usarla o forzar la creación de una nueva?`,
            [
              { text: 'Usar comanda existente', onPress: async () => { await doAddPedidos(resp.comandaExistente); } },
              { text: 'Forzar crear', onPress: async () => {
                try {
                  const forced: any = await comandaService.create({ mesaId: id }, { forzar: true });
                  let forcedObj = forced;
                  if (forced?.data) forcedObj = forced.data;
                  if (forcedObj?.data) forcedObj = forcedObj.data;
                  const forcedId = forcedObj?.id;
                  if (!forcedId) return Alert.alert('Error', 'No se recibió id de la comanda forzada');
                  await doAddPedidos(forcedId);
                } catch (err2: any) {
                  Alert.alert('Error', err2?.response?.data?.message || err2?.message || 'No se pudo forzar la creación');
                }
              } },
              { text: 'Cancelar', style: 'cancel' }
            ]
          );
        } else {
          Alert.alert('Error', 'No se pudo crear la comanda');
        }
        return;
      }
    }
    // if we get here, we have a comandaId (existing comanda) -> add pedidos
    await doAddPedidos(comandaId!);
  };

  const renderProductoCard = (p: Producto) => {
    const cantidad = cant[p.id] || 0;
    // prefer category over tipo — "Pizzas" should map to 🍕 even when tipo='comida'
    const key = p.categoria || p.tipo || p.nombre;
    const emoji = getEmojiPorTipo(key);
    const compact = viewMode === 'compact';
    
    return (
      <TouchableOpacity
        key={p.id}
        onPress={() => inc(p.id)}
        style={{
          width: compact ? '32%' : '49%',
          marginBottom: compact ? 6 : 6,
          padding: compact ? 4 : 6,
          borderRadius: 8,
          borderWidth: 2,
          borderColor: cantidad > 0 ? PRIMARY : (dark ? '#374151' : '#E5E7EB'),
          backgroundColor: dark ? '#1F2937' : '#F9FAFB',
          position: 'relative',
        }}
      >
        {/* Badge de cantidad */}
        {cantidad > 0 && (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              backgroundColor: '#ef4444',
              borderRadius: compact ? 9 : 10,
              width: compact ? 18 : 20,
              height: compact ? 18 : 20,
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
            }}
          >
            <Text style={{ color: 'white', fontSize: compact ? 10 : 11, fontWeight: '700' }}>{cantidad}</Text>
          </View>
        )}

        {/* Botón X para eliminar */}
        {cantidad > 0 && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              eliminar(p.id);
            }}
            style={{
              position: 'absolute',
              bottom: -6,
              right: -6,
              backgroundColor: 'white',
              borderRadius: compact ? 10 : 12,
              width: compact ? 22 : 24,
              height: compact ? 22 : 24,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: '#E5E7EB',
              zIndex: 10,
            }}
          >
            <Text style={{ color: '#ef4444', fontSize: compact ? 13 : 14, fontWeight: '700' }}>✕</Text>
          </TouchableOpacity>
        )}

        {/* Emoji del producto */}
        <Text style={{ fontSize: compact ? 16 : 20, textAlign: 'center', marginBottom: compact ? 2 : 2 }}>{emoji}</Text>

        {/* Nombre del producto */}
        <Text
          style={{
            fontWeight: '700',
            fontSize: compact ? 12 : 13,
            color: fg,
            textAlign: 'center',
            marginBottom: 2,
            minHeight: compact ? 20 : 24,
          }}
          numberOfLines={2}
        >
          {p.nombre}
        </Text>

        {/* Precio */}
        {p.precio != null && (
          <Text style={{ fontSize: 14, fontWeight: '700', color: PRIMARY, textAlign: 'center' }}>
            Bs {String(Number(p.precio).toFixed(2))}
          </Text>
        )}

        {/* Tipo (label pequeño) */}
        {p.tipo && (
          <Text
            style={{
              fontSize: 8,
              color: muted,
              textAlign: 'center',
              marginTop: 1,
              textTransform: 'uppercase',
              fontWeight: '600',
            }}
          >
            {p.tipo}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const categorias = Object.keys(productos);
  const tieneComandas = comandas.length > 0;
  const showProductsGrid = !(tieneComandas && showProductsMode === null);

  // animate show/hide for the products/categories UI
  useEffect(() => {
    Animated.timing(showProductsAnim, {
      toValue: showProductsGrid ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [showProductsGrid]);
  const categoriasConTodas = ['Todas', ...categorias];

  // Log para debugging
  useEffect(() => {
    console.log('[MesaProductos] Productos cargados:', Object.keys(productos).length, 'categorías');
    console.log('[MesaProductos] Categorías:', Object.keys(productos));
    const allProds = Object.values(productos).reduce((acc: Producto[], arr: Producto[]) => acc.concat(arr), []);
    console.log('[MesaProductos] Total productos:', allProds.length);
  }, [productos]);

  // NOTE: removed noisy debug useEffect to avoid accidental reference timing issues during HMR/bundling

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg, paddingBottom: footerHeight + 12 }}>
      {/* Success GIF modal (auto-dismiss) */}
      {/* <Modal visible={showSuccessGif} animationType="fade" transparent>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <View style={{ width: 180, height: 180, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' }}>
            <Image
              source={dark ? darkCheckGif : checkGif}
              style={{ width: 160, height: 160, resizeMode: 'contain' }}
            />
          </View>
        </View>
      </Modal> */}
      {/* Header con gradiente */}
      <View
        style={{
          paddingTop: 40, // ensure we don't overlap the status bar/time
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: dark ? '#1e3a8a' : PRIMARY,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View>
          <Text style={{ fontSize: 22, fontWeight: '700', color: 'white' }}>
            🪑 {mesaInfo?.nombre ?? (mesaInfo?.numero ? `Mesa ${mesaInfo.numero}` : 'Mesa')}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            backgroundColor: 'rgba(255,255,255,0.2)',
            borderRadius: 20,
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 24, color: 'white', fontWeight: '700' }}>×</Text>
        </TouchableOpacity>
      </View>

      {/* Mensaje cuando agregando pedidos */}
      {showProductsMode === 'add' && selectedComanda && (
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, backgroundColor: PRIMARY_TRANSPARENT, marginHorizontal: 12, marginTop: 12, borderRadius: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: dark ? 'white' : '#1e3a8a', textAlign: 'center' }}>
            Agregando pedidos a comanda {comandaIndex !== null ? comandaIndex + 1 : ''} • Mesa {mesaInfo?.nombre ?? String(mesaInfo?.numero)}
          </Text>
        </View>
      )}

      {/* Mostrar todas las comandas abiertas de la mesa */}
      {tieneComandas && showProductsMode === null && comandas.map((comanda, index) => {
        // Determinar si está entregada (sin importar si está cerrada o abierta)
        const estaEntregada = comanda.entregado === true;
        const estaCerrada = comanda.estado === 'cerrada';
        
        return (
          <TouchableOpacity
            key={comanda.id}
            onPress={() => { setSelectedComanda(comanda); setShowComandaDetalle(true); }}
            style={{
              margin: 12,
              marginTop: index === 0 ? 12 : 6,
              borderRadius: 12,
              padding: 12,
              backgroundColor: estaEntregada ? (dark ? '#064e3b' : '#dcfce7') : (dark ? '#0b1220' : '#FFF7ED'),
              borderWidth: estaEntregada ? 2 : 1,
              borderColor: estaEntregada ? '#16a34a' : (dark ? '#374151' : '#F59E0B'),
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: 12,
              overflow: 'hidden',
              shadowColor: estaEntregada ? '#16a34a' : '#F59E0B',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: estaEntregada ? 0.2 : 0.1,
              shadowRadius: 4,
              elevation: estaEntregada ? 4 : 2,
            }}
          >
          {/* pushpin visual */}
          <View style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 22 }}>📌</Text>
          </View>

          {estaEntregada && (
            <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: '#16a34a', borderRadius: 16, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'white', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 3 }}>
              <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>✓</Text>
            </View>
          )}

            <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontWeight: '800', color: estaEntregada && dark ? '#FFFFFF' : (dark ? 'white' : '#92400E'), fontSize: 16, marginBottom: 6 }}>
                {`Comanda ${index + 1} • ${mesaInfo?.nombre ?? (mesaInfo?.numero ? `Mesa ${String(mesaInfo.numero)}` : '')}`}
              </Text>
              {estaEntregada && estaCerrada && (
                <View style={{ marginLeft: 8, backgroundColor: '#059669', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.15, shadowRadius: 2, elevation: 2 }}>
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 11 }}>✓ $</Text>
                </View>
              )}
            </View>
            
                {/* preview of pedidos */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6 }}>
                  {comanda.pedidos?.slice(0, 5).map((p: any) => (
                    <View key={p.id} style={{ marginRight: 8, padding: 8, borderRadius: 8, backgroundColor: dark ? '#0b1220' : 'rgba(245, 158, 11, 0.08)', borderWidth: 1, borderColor: dark ? '#374151' : 'rgba(245,158,11,0.22)' }}>
                      <Text style={{ color: dark ? '#D1D5DB' : '#92400E', fontWeight: '700', fontSize: 12 }}>{String(p.cantidad)}x {p.producto?.nombre || 'Producto'}</Text>
                      <Text style={{ color: dark ? '#D1D5DB' : '#92400E', fontWeight: '600', fontSize: 11 }}>Bs {String(Number(p.precioUnitario || p.producto?.precio || 0).toFixed(2))}</Text>
                      {p.notas ? (
                        <Text style={{ color: '#92400E', backgroundColor: 'rgba(245,158,11,0.12)', padding: 4, borderRadius: 6, marginTop: 6, fontSize: 11 }}>{p.notas}</Text>
                      ) : null}
                    </View>
                  ))}
                </ScrollView>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                    {!estaEntregada && (
                      <TouchableOpacity onPress={() => { setShowProductsMode('add'); setSelectedComanda(comanda); setComandaIndex(index); setShowComandaDetalle(false); }} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: dark ? '#374151' : '#E5E7EB', backgroundColor: dark ? '#0b1220' : 'white' }}>
                        <Text style={{ color: dark ? '#D1D5DB' : '#374151', fontWeight: '700' }}>➕ Agregar pedidos</Text>
                      </TouchableOpacity>
                    )}
                  <TouchableOpacity onPress={() => { setSelectedComanda(comanda); setShowComandaDetalle(true); }} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: PRIMARY, flex: !estaEntregada ? 0 : 1 }}>
                    <Text style={{ color: 'white', fontWeight: '700' }}>{estaEntregada ? 'Ver comanda' : 'Abrir comanda'}</Text>
                  </TouchableOpacity>
                </View>
          </View>
        </TouchableOpacity>
        );

      })}

      {/* Crear nueva comanda CTA -- outside and below the pinned comanda card */}
      {tieneComandas && showProductsMode === null && (
        <View style={{ paddingHorizontal: 16, marginTop: 6, zIndex: 50, elevation: 8, pointerEvents: 'auto' }}>
          {/* small divider for visual separation */}
          <View style={{ height: 1, backgroundColor: dark ? '#0b1220' : '#F3F4F6', marginBottom: 8 }} />
          <TouchableOpacity onPress={() => { console.log('[MesaProductos] Crear nueva comanda pressed (user.tipo)', user?.tipo); setShowProductsMode('new'); setSelectedComanda(null); resetCantidades(); }} style={{ paddingVertical: 12, paddingHorizontal: 16, marginBottom: 12, borderRadius: 10, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb', alignItems: 'center' }}>
            <Text style={{ color: '#374151', fontWeight: '700' }}>➕ Crear nueva comanda</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Filtros de categorías (only visible with products) */}
      {/* animated container for categories + view-mode toggle */}
      <Animated.View style={{ opacity: showProductsAnim, transform: [{ translateY: showProductsAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }} pointerEvents={showProductsGrid ? 'auto' : 'none'}>
        {showProductsGrid && (
          <View style={{ backgroundColor: bg, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: dark ? '#374151' : '#E5E7EB' }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: muted, marginBottom: 8, paddingHorizontal: 16, textTransform: 'uppercase' }}>
          📂 Categorías
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12 }}>
          {categoriasConTodas.map((cat) => {
            const seleccionada = cat === categoriaSeleccionada;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setCategoriaSeleccionada(cat)}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  marginHorizontal: 4,
                  backgroundColor: seleccionada ? PRIMARY : (dark ? '#374151' : '#F3F4F6'),
                }}
              >
                <Text
                  style={{
                    color: seleccionada ? 'white' : (dark ? '#D1D5DB' : '#6B7280'),
                    fontWeight: seleccionada ? '700' : '400',
                  }}
                >
                  {cat === 'Todas' ? '🍽️ Todas' : cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        {/* Vista toggle: regular / compact */}
        <View style={{ flexDirection: 'row', marginTop: 8, paddingHorizontal: 12 }}>
          {([ 
            { key: 'regular', label: 'Regular' },
            { key: 'compact', label: 'Compacta' }
          ] as { key: 'regular' | 'compact'; label: string }[]).map((b) => (
                <TouchableOpacity
                  key={b.key}
                  onPress={async () => {
                    try {
                      setViewMode(b.key as 'regular' | 'compact');
                      await AsyncStorage.setItem('mesero_modo_vista', b.key);
                    } catch {}
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    marginRight: 8,
                    borderRadius: 8,
                    backgroundColor: viewMode === b.key ? PRIMARY_TRANSPARENT : '#F3F4F6',
                    borderWidth: 1,
                    borderColor: viewMode === b.key ? PRIMARY : '#E5E7EB',
                  }}
                >
                  <Text style={{ color: viewMode === b.key ? PRIMARY : '#374151', fontWeight: '600' }}>{b.label}</Text>
                </TouchableOpacity>
              ))}
          </View>
        </View>
        )}
      </Animated.View>

      {/* Grid de productos (hidden when comanda exists unless user chooses add/new) */}
      {showProductsGrid ? (
        <ScrollView contentContainerStyle={{ padding: 6, paddingBottom: totalItems > 0 ? 100 : 20 }}>
        {loading && categorias.length === 0 ? (
          <View style={{ padding: 24 }}>
            <Text style={{ textAlign: 'center', color: muted }}>Cargando productos…</Text>
          </View>
        ) : productosFiltrados.length === 0 ? (
          <View style={{ padding: 24 }}>
            <Text style={{ textAlign: 'center', color: muted }}>No hay productos en esta categoría</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 4 }}>
            {productosFiltrados.map((p: Producto) => renderProductoCard(p))}
          </View>
        )}
        </ScrollView>
      ) : (
        // We purposely hide products when table already has a comanda and user didn't ask to view products
        <Animated.View style={{ padding: 20, alignItems: 'center', opacity: showProductsAnim, transform: [{ translateY: showProductsAnim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }}>
          <Text style={{ color: muted }}>Productos ocultos — selecciona “➕ Agregar pedidos” o “➕ Crear nueva comanda” para ver la carta</Text>
        </Animated.View>
      )}

      {/* Botón flotante "Ver Pedido" */}
      {totalItems > 0 && (
        <View
          style={{
            position: 'absolute',
            bottom: footerHeight + 8,
            left: 0,
            right: 0,
            padding: 16,
            paddingBottom: 20,
            pointerEvents: 'box-none',
          }}
        >
          <TouchableOpacity
            onPress={() => setMostrarPedido(true)}
            style={{
              backgroundColor: '#10b981',
              paddingVertical: 16,
              paddingHorizontal: 24,
              borderRadius: 24,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <Text style={{ color: 'white', fontSize: 18, fontWeight: '700' }}>
              👀 Ver Pedido ({String(totalItems)} {totalItems === 1 ? 'producto' : 'productos'})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Modal de resumen de pedido */}
      <Modal visible={mostrarPedido} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: bg,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 20,
              paddingBottom: 20,
              maxHeight: '80%',
            }}
          >
            {/* Header del modal */}
            <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
              <Text style={{ fontSize: 20, fontWeight: '700', color: fg }}>📋 Resumen del Pedido</Text>
            </View>

            {/* Lista de productos seleccionados */}
            <ScrollView style={{ maxHeight: 300, paddingHorizontal: 20 }}>
              {Object.entries(cant)
                .filter(([, cantidad]) => cantidad > 0)
                .map(([pid, cantidad]) => {
                  const allProductos = Object.values(productos).reduce((acc: Producto[], arr: Producto[]) => acc.concat(arr), []);
                  const producto = allProductos.find((p: Producto) => String(p.id) === String(pid));
                  if (!producto) return null;
                  const key = producto.categoria || producto.tipo || producto.nombre;
                  const emoji = getEmojiPorTipo(key);
                  const subtotal = Number(producto.precio || 0) * cantidad;

                  return (
                    <View
                      key={pid}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: dark ? '#374151' : '#E5E7EB',
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: fg }}>
                          {emoji} {producto.nombre}
                        </Text>
                        <Text style={{ fontSize: 14, color: muted, marginTop: 2 }}>
                          {String(cantidad)} x Bs {String(Number(producto.precio).toFixed(2))}
                        </Text>
                        {/* Nota editable */}
                        <TextInput
                          placeholder="Añadir nota (ej. sin picante)"
                          placeholderTextColor={muted}
                          value={notas[pid] || ''}
                          onChangeText={(v) => setNotas((s) => ({ ...s, [pid]: v }))}
                          style={{
                            borderWidth: 1,
                            borderColor: dark ? '#374151' : '#E5E7EB',
                            padding: 8,
                            borderRadius: 8,
                            marginTop: 8,
                            color: fg,
                            fontSize: 13,
                          }}
                        />
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: PRIMARY }}>
                        Bs {String(subtotal.toFixed(2))}
                      </Text>
                    </View>
                  );
                })}
            </ScrollView>

            {/* Total general */}
              <View
              style={{
                marginHorizontal: 20,
                marginVertical: 16,
                padding: 16,
                borderRadius: 12,
                backgroundColor: dark ? '#1e3a8a' : PRIMARY_TRANSPARENT,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: dark ? 'white' : '#1e3a8a' }}>
                  💰 Total General:
                </Text>
                <Text style={{ fontSize: 24, fontWeight: '700', color: dark ? 'white' : '#1e3a8a' }}>
                  Bs {String(totalPrecio.toFixed(2))}
                </Text>
              </View>
            </View>

            {/* Botones de acción */}
            <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20 }}>
              <TouchableOpacity
                onPress={() => { setMostrarPedido(false); setShowProductsMode(null); setSelectedComanda(null); setComandaIndex(null); resetCantidades(); }}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: dark ? '#6B7280' : '#D1D5DB',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: muted, fontWeight: '600' }}>Cerrar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={loading}
                onPress={enviar}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  borderRadius: 12,
                  backgroundColor: '#10b981',
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
                  {loading ? 'Enviando...' : `Enviar Pedido (${String(totalItems)})`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Comanda Detail Modal (when opening an existing comanda) */}
      <Modal visible={showComandaDetalle && !!selectedComanda} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 20, paddingBottom: 20, maxHeight: '85%' }}>
            <View style={{ paddingHorizontal: 20, marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 20, fontWeight: '700', color: fg }}>🧾 Comanda • {mesaInfo?.nombre ?? String(mesaInfo?.numero)}</Text>
                {/* Mostrar badge de cobrado+entregado cuando aplica */}
                {selectedComanda && selectedComanda.estado === 'cerrada' && selectedComanda.entregado === true && (
                  <View style={{ marginLeft: 6, backgroundColor: '#16a34a', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ color: 'white', fontWeight: '800', fontSize: 12 }}>✓ $ cobrado</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => { setShowComandaDetalle(false); setSelectedComanda(null); }}>
                <Text style={{ color: '#ef4444', fontSize: 20 }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={{ paddingHorizontal: 20, maxHeight: 380 }}>
              {selectedComanda?.pedidos?.map((p: any) => (
                <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: dark ? '#374151' : '#E5E7EB' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: fg, fontWeight: '700' }}>{String(p.cantidad)} x {p.producto?.nombre}</Text>
                    <Text style={{ color: muted, fontSize: 12 }}>{p.notas}</Text>
                  </View>
                  <Text style={{ color: PRIMARY, fontWeight: '700' }}>Bs {String(Number(p.precioUnitario || p.producto?.precio || 0).toFixed(2))}</Text>
                </View>
              ))}

              {/* Total section */}
              <View style={{ marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: dark ? '#0b1220' : '#FEF3C7', borderWidth: 1, borderColor: dark ? '#374151' : '#F59E0B' }}>
                <Text style={{ fontWeight: '700', color: dark ? 'white' : '#92400E' }}>
                  Total: Bs {String(Number((selectedComanda?.pedidos || []).reduce((s: number, x: any) => s + Number(x.subtotal || (x.precioUnitario || x.producto?.precio || 0) * x.cantidad), 0)).toFixed(2))}
                </Text>
              </View>

              {/* Payment method display */}
              {selectedComanda?.estado === 'cerrada' && selectedComanda?.metodoPago && (
                <View style={{ marginTop: 12, padding: 12, borderRadius: 8, backgroundColor: dark ? '#0b1220' : '#DBEAFE', borderWidth: 1, borderColor: dark ? '#374151' : '#93C5FD' }}>
                  <Text style={{ fontWeight: '700', color: dark ? 'white' : '#1e40af' }}>Payment Method: {selectedComanda.metodoPago === 'efectivo' ? 'Cash' : selectedComanda.metodoPago === 'qr' ? 'QR' : selectedComanda.metodoPago === 'mixto' ? 'Mixed (Cash + QR)' : selectedComanda.metodoPago}</Text>
                </View>
              )}
            </ScrollView>


            <View style={{ paddingHorizontal: 20, paddingTop: 12, flexDirection: 'row', gap: 8 }}>
              {/* Si la comanda está entregada Y cerrada, no permitimos agregar ni cobrar — acceso informativo */}
              {selectedComanda?.entregado === true && selectedComanda?.estado === 'cerrada' ? (
                <>
                  <View style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: dark ? '#374151' : '#E5E7EB', alignItems: 'center', backgroundColor: dark ? '#0b1220' : '#F3F4F6', opacity: 0.6 }}>
                    <Text style={{ color: muted, fontWeight: '700' }}>➕ Agregar pedidos</Text>
                  </View>
                  <View style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: dark ? '#374151' : '#E5E7EB', alignItems: 'center', justifyContent: 'center', backgroundColor: dark ? '#0b1220' : '#F3F4F6' }}>
                    <Text style={{ color: muted, fontWeight: '700' }}>🔒 Comanda cerrada — sólo lectura</Text>
                  </View>
                </>
              ) : (
                <>
                  <TouchableOpacity onPress={() => { setShowProductsMode('add'); setShowComandaDetalle(false); }} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: dark ? '#374151' : '#E5E7EB', alignItems: 'center' }}>
                    <Text style={{ color: muted, fontWeight: '700' }}>➕ Agregar pedidos</Text>
                  </TouchableOpacity>
                  {/* Mostrar Generar cuenta sólo si no hay pedidos pendientes y comanda no está cerrada */}
                  {selectedComanda && ((selectedComanda.pedidos || []).filter((p: any) => p.estado !== 'listo' && p.estado !== 'cancelado').length === 0) && selectedComanda?.estado !== 'cerrada' ? (
                    <TouchableOpacity onPress={() => setShowPaymentModal(true)} style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#10b981', alignItems: 'center' }}>
                      <Text style={{ color: 'white', fontWeight: '700' }}>💳 Generar cuenta</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12 }}>
                      <Text style={{ color: muted, fontSize: 12 }}>Aún hay pedidos pendientes</Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Payment modal */}
      <Modal visible={showPaymentModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: fg, marginBottom: 8 }}>💳 Pagar comanda</Text>
            <Text style={{ color: muted, fontSize: 12, marginBottom: 12 }}>Total: Bs {String(Number((selectedComanda?.pedidos || []).reduce((s: number, x: any) => s + Number(x.subtotal || (x.precioUnitario || x.producto?.precio || 0) * x.cantidad), 0)).toFixed(2))}</Text>

            {/* Opciones de pago */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {(['efectivo','qr','mixto'] as any[]).map((m) => (
                <TouchableOpacity key={m} onPress={() => setPagoMetodo(m)} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: pagoMetodo === m ? PRIMARY : (dark ? '#374151' : '#E5E7EB'), backgroundColor: pagoMetodo === m ? PRIMARY_TRANSPARENT : (dark ? '#0b1220' : '#f8fafc') }}>
                  <Text style={{ fontWeight: '700', color: pagoMetodo === m ? PRIMARY : muted }}>{m === 'efectivo' ? 'Efectivo' : m === 'qr' ? 'QR' : 'Mixto'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {pagoMetodo === 'mixto' && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: muted, fontSize: 12 }}>Monto en efectivo</Text>
                <TextInput value={montoEfectivoPago} onChangeText={setMontoEfectivoPago} keyboardType="numeric" placeholder="Ej. 50.00" placeholderTextColor={muted} style={{ borderWidth: 1, borderColor: dark ? '#374151' : '#E5E7EB', padding: 8, borderRadius: 8, color: fg, marginTop: 6 }} />

                <View style={{ marginTop: 8 }}>
                  <Text style={{ color: muted, fontSize: 12 }}>Monto QR calculado</Text>
                  <Text style={{ color: fg, fontWeight: '700', marginTop: 6 }}>
                    Bs {String(Number((Number((selectedComanda?.pedidos || []).reduce((s: number, x: any) => s + Number(x.subtotal || (x.precioUnitario || x.producto?.precio || 0) * x.cantidad), 0)) - Number(montoEfectivoPago || '0')) || 0).toFixed(2))}
                  </Text>
                </View>
              </View>
            )}

            {(pagoMetodo === 'qr' || pagoMetodo === 'mixto') && (
              <View style={{ marginBottom: 12, padding: 12, backgroundColor: dark ? '#0b1220' : '#f9fafb', borderRadius: 8, borderWidth: 1, borderColor: dark ? '#374151' : '#e5e7eb' }}>
                <Text style={{ color: muted, fontSize: 12, marginBottom: 12, fontWeight: '600' }}>{comprobanteEsRespaldo ? '📸 Comprobante de respaldo' : '📱 QR para pagar'}</Text>
                
                {comprobanteImagen ? (
                  <View style={{ alignItems: 'center', marginBottom: 12 }}>
                    <Image 
                      source={{ uri: comprobanteImagen }} 
                      style={{ width: 240, height: 240, borderRadius: 8, backgroundColor: 'white' }} 
                      resizeMode='contain' 
                    />
                    <Text style={{ color: muted, fontSize: 10, marginTop: 8 }}>{comprobanteEsRespaldo ? 'Foto del comprobante de pago' : 'El cliente puede escanear este QR'}</Text>
                  </View>
                ) : (
                  <View style={{ alignItems: 'center', marginBottom: 12, paddingVertical: 20 }}>
                    <Text style={{ color: muted, fontSize: 12 }}>Cargando QR...</Text>
                  </View>
                )}
                
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={async () => {
                    const permission = await ImagePicker.requestCameraPermissionsAsync();
                    if (!permission.granted) { Alert.alert('Permiso requerido', 'Necesitas permiso para usar la cámara'); return; }
                    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ((ImagePicker as any).MediaType?.Images ?? (ImagePicker as any).MediaTypeOptions?.Images), allowsEditing: true, quality: 0.7, base64: true });
                    if (!result.canceled && result.assets[0]) {
                      setComprobanteImagen(`data:image/jpeg;base64,${result.assets[0].base64}`);
                      setComprobanteEsRespaldo(true);
                    }
                  }} style={{ flex: 1, padding: 10, backgroundColor: PRIMARY, borderRadius: 8, alignItems: 'center' }}>
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>📷 Foto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={async () => {
                    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ((ImagePicker as any).MediaType?.Images ?? (ImagePicker as any).MediaTypeOptions?.Images), allowsEditing: true, quality: 0.7, base64: true });
                    if (!result.canceled && result.assets[0]) {
                      setComprobanteImagen(`data:image/jpeg;base64,${result.assets[0].base64}`);
                      setComprobanteEsRespaldo(true);
                    }
                  }} style={{ flex: 1, padding: 10, backgroundColor: '#8b5cf6', borderRadius: 8, alignItems: 'center' }}>
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>🖼️ Galería</Text>
                  </TouchableOpacity>
                  {comprobanteImagen && (
                    <TouchableOpacity onPress={() => {
                      if (!comprobanteEsRespaldo) {
                        setComprobanteImagen(null);
                      }
                    }} style={{ flex: 1, padding: 10, backgroundColor: comprobanteEsRespaldo ? '#10b981' : '#ef4444', borderRadius: 8, alignItems: 'center' }}>
                      <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>{comprobanteEsRespaldo ? '✓ Guardar' : '✕ Cambiar'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => setShowPaymentModal(false)} style={{ flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: dark ? '#374151' : '#E5E7EB', alignItems: 'center' }}>
                <Text style={{ color: muted }}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={async () => {
                // validate
                const total = Number((selectedComanda?.pedidos || []).reduce((s: number, x: any) => s + Number(x.subtotal || (x.precioUnitario || x.producto?.precio || 0) * x.cantidad), 0));
                if (!selectedComanda) return Alert.alert('Error', 'No hay comanda seleccionada');
                // safety: if comanda was closed+entregado today it's readonly / already charged
                if (selectedComanda.estado === 'cerrada' && selectedComanda.entregado === true) {
                  return Alert.alert('Comanda', 'Esta comanda ya fue cerrada y entregada (y cobrada) — solo lectura');
                }
                if ((pagoMetodo === 'qr' || pagoMetodo === 'mixto') && !comprobanteImagen) return Alert.alert('Error', 'Debes adjuntar el comprobante');
                let montoEfectivo = 0;
                if (pagoMetodo === 'mixto') {
                  montoEfectivo = Number(montoEfectivoPago || '0');
                  if (isNaN(montoEfectivo) || montoEfectivo <= 0 || montoEfectivo >= total) return Alert.alert('Error', 'Monto efectivo inválido');
                }
                const payload: any = { metodoPago: pagoMetodo };
                if (pagoMetodo === 'qr') payload.comprobante = comprobanteImagen;
                if (pagoMetodo === 'mixto') { payload.montoEfectivo = montoEfectivo; payload.montoQr = Number((total - montoEfectivo).toFixed(2)); payload.comprobante = comprobanteImagen; }

                try {
                  setLoadingPago(true);
                  const resp: any = await (await import('../../../src/services/comanda')).comandaService.cerrar(selectedComanda.id, payload);
                  // success - play sound and show gif
                  try {
                    const { Audio } = await import('expo-av');
                    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
                    const { sound } = await Audio.Sound.createAsync(require('../../../assets/success.mp3'));
                    await sound.playAsync();
                  } catch (e) {
                    console.warn('Failed to play sound:', e);
                  }
                  setShowPaymentModal(false);
                  setShowComandaDetalle(false);
                  setShowSuccessGif(true);
                  setTimeout(async () => {
                    setShowSuccessGif(false);
                    try { await cargarComandas(); } catch {}
                    try { router.replace('/mesero'); } catch (err) { console.warn('router.replace /mesero failed', err); }
                  }, 3200);
                } catch (err: any) {
                  Alert.alert('Error', err?.response?.data?.message || err?.message || 'Error generando cuenta');
                } finally { setLoadingPago(false); }
              }} style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#10b981', alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '700' }}>{loadingPago ? 'Procesando...' : 'Confirmar y cobrar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* Success GIF Modal */}
      <Modal visible={showSuccessGif} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.8)', alignItems: 'center', justifyContent: 'center' }}>
          <Image 
            source={dark ? darkCheckGif : checkGif} 
            style={{ width: 200, height: 200 }} 
            resizeMode='contain' 
          />
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
