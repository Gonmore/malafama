import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Text, TouchableOpacity, Pressable, View, ScrollView, Animated, Image, Dimensions, Modal, TextInput, Switch, LayoutAnimation, UIManager, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { userService } from '../../src/services/user';
import { useThemeStore } from '../../src/store/theme';
import TopNav from '../components/TopNav';
import { useRouter } from 'expo-router';
import { mesaService, Mesa } from '../../src/services/mesa';
import { comandaService } from '../../src/services/comanda';
import { useAuthStore } from '../../src/store/auth';
import { getSocket, createSocket } from '../../src/services/socket';
import { localService } from '../../src/services/local';
import { PRIMARY } from '../../src/constants/colors';

type MesaConComanda = Mesa & {
  comandas?: any[];
  disponible?: boolean;
  usuariosAsignados?: Array<{ id: string; nombre?: string; foto?: string }>;
};

export default function MeseroDashboard() {
  // Enable LayoutAnimation on Android
  useEffect(() => {
    try {
      if (Platform.OS === 'android' && (UIManager as any)?.setLayoutAnimationEnabledExperimental) {
        (UIManager as any).setLayoutAnimationEnabledExperimental(true);
      }
    } catch {}
  }, []);

  // Core app state and helpers (restored to fix missing identifiers)
  const router = useRouter();
  const authStoreAny: any = useAuthStore as any;
  const authStateAny: any = (useAuthStore as any).getState ? (useAuthStore as any).getState() : {};
  const user: any = authStateAny.user || authStateAny.usuario || null;
  const token: string | undefined = authStateAny.token;
  const logout = () => {
    try {
      const s: any = (useAuthStore as any);
      if (s.getState && s.getState().logout) s.getState().logout();
    } catch (e) {}
  };

  const updateUser = async (patch: any) => {
    try {
      if (!user?.id) return null;
      const resp = await userService.update(user.id, patch);
      return resp;
    } catch (err) {
      console.error('updateUser error', err);
      return null;
    }
  };

  const themeStateAny: any = (useThemeStore as any).getState ? (useThemeStore as any).getState() : {};
  const dark = themeStateAny.theme === 'dark' || themeStateAny.dark === true;
  const setTheme = (t: string) => {
    try { const s: any = (useThemeStore as any); if (s.getState && s.getState().set) s.getState().set(t); } catch (e) {}
  };
  const bg = dark ? '#07101a' : '#FFFFFF';
  const fg = dark ? '#F9FAFB' : '#111827';
  const muted = dark ? '#9CA3AF' : '#6B7280';

  const [mesas, setMesas] = useState<any[]>([]);
  const [tiempoActual, setTiempoActual] = useState<Date>(new Date());
  const [showModal, setShowModal] = useState<boolean>(false);
  const [tempNombre, setTempNombre] = useState<string>('');
  const [localLogo, setLocalLogo] = useState<any>(null);
  const [modalHandAnim, setModalHandAnim] = useState<any>(null);

  const [showAssignModalMobile, setShowAssignModalMobile] = useState<boolean>(false);
  const [modalMesas, setModalMesas] = useState<any[]>([]);
  const [assignSelected, setAssignSelected] = useState<Set<string>>(new Set());
  const [isAdmin] = useState<boolean>(Boolean(user && (user.rol === 'admin' || user.tipo === 'admin')));
  const [viewMode, setViewMode] = useState<'list'|'group'>('list');
  const [verSoloAsignadas, setVerSoloAsignadas] = useState<boolean>(false);
  const [scrollEnabled, setScrollEnabled] = useState<boolean>(true);

  // load() - fetch mesas (keeps it simple to restore behavior)
  const load = async () => {
    try {
      loadInFlightRef.current = true;
      const resp = await mesaService.getAssigned();
      const data = resp?.data || resp || [];
      const lista = Array.isArray(data) ? data : (data.mesas || data);
      setMesas(lista || []);
    } catch (e) {
      console.error('[mesero] load error', e);
    } finally {
      lastLoadTsRef.current = Date.now();
      loadInFlightRef.current = false;
    }
  };

  let lightFooterLogo: any = null;
  let darkFooterLogo: any = null;
  try {
    lightFooterLogo = require('../../assets/SNT_logo/Logo_Azul.png');
    darkFooterLogo = require('../../assets/SNT_logo/Logo_Blanco.png');
  } catch (err) {
    // fallback to text
  }
  // comanda background assets (simple templates)
  let comandaSimpleLight: any = null;
  let comandaSimpleDark: any = null;
  try {
    comandaSimpleLight = require('../../assets/comandaGrasa.jpg');
  } catch (err) {
    // ignore if not present
  }
  try {
    comandaSimpleDark = require('../../assets/comandaGrasaDark.jpg');
  } catch (err) {
    // ignore if not present
  }

  const window = Dimensions.get('window');
  const footerHeight = Math.max(56, Math.round(window.height * 0.072));
  const [gridLayout, setGridLayout] = useState<{ width: number; height: number } | null>(null);
  // Optimistic entregadas to show check immediately on first touch
  const [deliveredOptimistic, setDeliveredOptimistic] = useState<Set<string>>(new Set());
  // Press feedback state for grouped grid tiles
  const [pressedMesaId, setPressedMesaId] = useState<string | null>(null);
  const pressAnim = useRef(new Animated.Value(1)).current;

  const handleResponderGrant = (mesaId: any) => {
    try {
      setPressedMesaId(String(mesaId));
      pressAnim.setValue(0.98);
      Animated.timing(pressAnim, { toValue: 0.96, duration: 90, useNativeDriver: true }).start();
    } catch (e) {}
  };

  const handleResponderRelease = (mesa: any) => {
    try {
      Animated.timing(pressAnim, { toValue: 1, duration: 140, useNativeDriver: true }).start(() => setPressedMesaId(null));
      onAbrirComanda(mesa);
    } catch (e) {}
  };

  const handleResponderTerminate = () => {
    try {
      Animated.timing(pressAnim, { toValue: 1, duration: 140, useNativeDriver: true }).start(() => setPressedMesaId(null));
    } catch (e) {}
  };
  // Debounce for load() calls to prevent hammering the API
  const loadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadInFlightRef = useRef(false);
  const lastLoadTsRef = useRef(0);
  const requestLoad = () => {
    try {
      const now = Date.now();
      // hard throttle: ignore requests if a load is in-flight or last load < 800ms ago
      if (loadInFlightRef.current || (now - lastLoadTsRef.current) < 800) return;
      if (loadDebounceRef.current) clearTimeout(loadDebounceRef.current);
      loadDebounceRef.current = setTimeout(() => {
        load();
      }, 250);
    } catch {}
  };

  // Actualizar tiempo cada segundo para mostrar tiempos dinámicos
  useEffect(() => {
    const intervalo = setInterval(() => {
      setTiempoActual(new Date());
    }, 1000);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    setTempNombre(user?.nombre || '');
  }, [user?.nombre]);

  // Refresh when screen gains focus (single shot). Remove continuous polling.
  useFocusEffect(
    useMemo(() => {
      requestLoad();
      return () => {};
    }, [])
  );

  // Componente que representa una comanda completa (maneja animación del borde cuando TODOS los pedidos están listos)
  const openAssignModalMobile = async () => {
    try {
      // load all mesas for selection UI and the currently assigned IDs
      const [allRes, assignedRes] = await Promise.all([mesaService.getAll(), mesaService.getAssigned()]);
      const all = Array.isArray(allRes) ? allRes : (allRes?.data || allRes?.mesas || []);
      setModalMesas(all || []);
      const assignedIds = Array.isArray(assignedRes) ? assignedRes.map((m: any) => m.id) : ((assignedRes?.data || []).map((m: any) => m.id || m));
      setAssignSelected(new Set(assignedIds || []));
      setShowAssignModalMobile(true);
    } catch (err) {
      console.error('Error cargando asignaciones', err);
      Alert.alert('Error', 'No se pudieron cargar las mesas asignadas');
    }
  };

  const toggleAssign = (id: string) => {
    setAssignSelected(prev => {
      const copy = new Set(prev);
      if (copy.has(id)) copy.delete(id);
      else copy.add(id);
      return copy;
    });
  };

  const saveAssignMobile = async () => {
    try {
      const mesaIds = Array.from(assignSelected);
      await mesaService.assignMesas(mesaIds);
      setShowAssignModalMobile(false);
      requestLoad();
      Alert.alert('Mesas', 'Mesas asignadas correctamente');
    } catch (err: any) {
      console.error('Error asignando mesas', err);
      Alert.alert('Error', err?.response?.data?.message || 'No se pudieron asignar las mesas');
    }
  };
  // --- List-mode comanda row (original compact style) ---
  const ComandaListRow = ({ comanda, idx, dark, fg, onOpen, estaEntregada = false, onMarcarEntregada }: any) => {
    const todosListos = comanda.pedidos && comanda.pedidos.length > 0 && comanda.pedidos.every((p: any) => p.estado === 'listo');
    const minutes = comanda ? Math.max(0, Math.floor((Date.now() - new Date(comanda.createdAt || comanda.created_at).getTime()) / 60000)) : 0;
    const timeColor = getAgeColor(minutes);
    const borderAnim = useRef(new Animated.Value(1)).current;
    const bounceAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      if (todosListos && !estaEntregada) {
        const blink = Animated.loop(
          Animated.sequence([
            Animated.timing(borderAnim, { toValue: 0.3, duration: 2800, useNativeDriver: true }),
            Animated.timing(borderAnim, { toValue: 1, duration: 2800, useNativeDriver: true }),
          ])
        );

        const bounce = Animated.loop(
          Animated.sequence([
            Animated.timing(bounceAnim, { toValue: -6, duration: 1800, useNativeDriver: true }),
            Animated.timing(bounceAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
          ])
        );

        blink.start();
        bounce.start();
        return () => {
          blink.stop();
          bounce.stop();
        };
      } else {
        borderAnim.setValue(1);
        bounceAnim.setValue(0);
      }
    }, [todosListos, borderAnim, bounceAnim]);

    return (
          <Animated.View
        key={comanda.id}
        style={{
          marginBottom: idx < 999 ? 5 : 0,
          flexDirection: 'row',
          backgroundColor: dark ? '#111827' : 'white',
          borderRadius: 6,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
          elevation: 2,
          borderWidth: 0,
          borderColor: 'transparent',
          opacity: estaEntregada ? 1 : (todosListos ? borderAnim : 1),
        }}
      >
          <TouchableOpacity
          onPress={() => {
            if (todosListos && !estaEntregada) {
              onMarcarEntregada && onMarcarEntregada();
            } else {
              onOpen && onOpen();
            }
          }}
          style={{
            width: 48,
            backgroundColor: dark ? '#111827' : '#F3F4F6',
            borderRightWidth: 2,
            borderRightColor: todosListos ? '#22c55e' : (dark ? '#4B5563' : '#D1D5DB'),
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 8,
            position: 'relative',
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '700', color: fg }}>C{idx + 1}</Text>
          <Text style={{ fontSize: 11, fontWeight: '700', color: timeColor, includeFontPadding: false, transform: [{ translateY: -2 }, { translateX: 2 }] }}>{formatTiempo(comanda.createdAt || comanda.created_at)}</Text>

          {todosListos && !estaEntregada && (
            <Animated.View style={{ position: 'absolute', bottom: -6, right: -6, ...(bounceAnim ? { transform: [{ translateY: bounceAnim }] } : {}) }}>
              <Text style={{ fontSize: 22 }}>👆🏽</Text>
            </Animated.View>
          )}
        </TouchableOpacity>

        <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 6 }}>
          {(comanda.pedidos || []).map((pedido: any) => (
            <View key={pedido.id} style={{ marginRight: 8 }}>
              <PedidoChip pedido={pedido} dark={dark} fg={fg} comandaReady={todosListos || estaEntregada} />
            </View>
          ))}

          {estaEntregada && (
            <View style={{ position: 'absolute', bottom: 6, right: 6, width: 26, height: 26, backgroundColor: '#16a34a', borderRadius: 13, borderWidth: 2, borderColor: 'white', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: 'white', fontSize: 14, fontWeight: '700' }}>✓</Text>
            </View>
          )}

          {estaEntregada && (comanda?.estado === 'cerrada' || comanda?.estado === 'CERRADA') && (
            <View style={{ position: 'absolute', bottom: 6, right: 38, width: 20, height: 20, backgroundColor: '#f59e0b', borderRadius: 10, borderWidth: 1, borderColor: 'white', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>$</Text>
            </View>
          )}
        </View>
        {(todosListos || estaEntregada) && (
            <Animated.View
              pointerEvents="box-none"
            style={{
              position: 'absolute',
              left: -3,
              right: -3,
              top: -3,
              bottom: -3,
              borderRadius: 8,
              borderWidth: 4,
              borderColor: '#22c55e',
              opacity: estaEntregada ? 1 : (todosListos ? borderAnim : 1),
            }}
          />
        )}
      </Animated.View>
    );
  };

  // --- Notebook-style comanda block used in grouped/grid view ---
  // Ref map to store measured heights per comanda block and a small key to trigger re-render when measured
  const gridHeightsRef = useRef<Record<string, number>>({});
  const [gridKey, setGridKey] = useState(0);

  const ComandaRow = ({ comanda, idx, dark, fg, onOpen, estaEntregada = false, onMarcarEntregada, styleVariant = 'classic' }: any) => {
    const pedidos = comanda.pedidos || [];
    const bebidas = pedidos.filter((p: any) => isBebidaProducto(p.producto));
    const comidas = pedidos.filter((p: any) => !isBebidaProducto(p.producto));
    const bebidasReady = bebidas.filter((p: any) => p.estado === 'listo').length;
    const comidasReady = comidas.filter((p: any) => p.estado === 'listo').length;

    const minutes = comanda ? Math.max(0, Math.floor((Date.now() - new Date(comanda.createdAt || comanda.created_at).getTime()) / 60000)) : 0;
    const timeColor = getAgeColor(minutes);

    const bebidasAllReady = bebidas.length > 0 && bebidasReady === bebidas.length;
    const comidasAllReady = comidas.length > 0 && comidasReady === comidas.length;
    // Consider "all ready" when each present category is fully ready.
    const allReady = (bebidas.length === 0 || bebidasAllReady) && (comidas.length === 0 || comidasAllReady);

    const borderAnim = useRef(new Animated.Value(0)).current; // used for border opacity
    const bounceAnim = useRef(new Animated.Value(0)).current; // for hand subtle bounce
    const [bebidasBlink] = useState(() => new Animated.Value(1));
    const [comidasBlink] = useState(() => new Animated.Value(1));

    const [showHint, setShowHint] = useState(false);

    // start per-category blink when all ready
    useEffect(() => {
      if (bebidasAllReady || (bebidas.length > 0 && comidas.length === 0 && allReady)) {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(bebidasBlink, { toValue: 0.3, duration: 600, useNativeDriver: true }),
            Animated.timing(bebidasBlink, { toValue: 1, duration: 600, useNativeDriver: true }),
          ])
        );
        loop.start();
        return () => loop.stop();
      } else {
        bebidasBlink.setValue(1);
      }
    }, [bebidasAllReady, bebidasBlink]);

    useEffect(() => {
      if (comidasAllReady || (comidas.length > 0 && bebidas.length === 0 && allReady)) {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(comidasBlink, { toValue: 0.3, duration: 600, useNativeDriver: true }),
            Animated.timing(comidasBlink, { toValue: 1, duration: 600, useNativeDriver: true }),
          ])
        );
        loop.start();
        return () => loop.stop();
      } else {
        comidasBlink.setValue(1);
      }
    }, [comidasAllReady, comidasBlink]);

    // border and hand hint when BOTH categories ready
    useEffect(() => {
      let borderLoop: any = null;
      let bounceLoop: any = null;
      const checkAndMaybeShowHint = async () => {
        try {
          if (!allReady || estaEntregada) {
            setShowHint(false);
            return;
          }
          // only show hint once per day per mesero
          const uid = String(user?.id || 'anon');
          const today = new Date().toISOString().slice(0, 10);
          const key = `entregado_shown_${uid}_${today}`;
          const value = await AsyncStorage.getItem(key);
          if (!value) {
            setShowHint(true);
            // do not mark it yet; only mark when user taps entregado
          } else {
            setShowHint(false);
          }
        } catch (err) {
          console.error('Error checking hint flag', err);
        }
      };

      if (allReady && !estaEntregada) {
        borderLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(borderAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.timing(borderAnim, { toValue: 0.2, duration: 800, useNativeDriver: true }),
          ])
        );
        bounceLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(bounceAnim, { toValue: -6, duration: 900, useNativeDriver: true }),
            Animated.timing(bounceAnim, { toValue: 0, duration: 900, useNativeDriver: true }),
          ])
        );
        borderLoop.start();
        bounceLoop.start();
        checkAndMaybeShowHint();
      } else {
        borderAnim.setValue(0);
        bounceAnim.setValue(0);
        setShowHint(false);
      }

      return () => {
        borderLoop && borderLoop.stop && borderLoop.stop();
        bounceLoop && bounceLoop.stop && bounceLoop.stop();
      };
    }, [allReady, estaEntregada, borderAnim, bounceAnim]);

    const markHintShownForToday = async () => {
      try {
        const uid = String(user?.id || 'anon');
        const today = new Date().toISOString().slice(0, 10);
        const key = `entregado_shown_${uid}_${today}`;
        await AsyncStorage.setItem(key, '1');
        setShowHint(false);
      } catch (err) {
        console.error('Error setting hint flag', err);
      }
    };

    const handlePress = async () => {
      if (allReady && !estaEntregada) {
        // mark entregada
        try {
          await onMarcarEntregada?.();
        } catch (err) {
          console.error('Error marcando entregada', err);
        }
        // mark hint so it won't show again today
        await markHintShownForToday();
      } else {
        onOpen && onOpen();
      }
    };

    const renderPalitos = (count: number, ready: number) => {
      const groups = Math.ceil(Math.max(0, count) / 5);
      const items: any[] = [];
      for (let g = 0; g < groups; g++) {
        const start = g * 5;
        const groupCount = Math.min(5, Math.max(0, count - start));
        items.push(
          <View key={`g${g}`} style={{ flexDirection: 'row', alignItems: 'flex-end', marginRight: 8 }}>
            {Array.from({ length: groupCount }).map((_, i) => {
              const absoluteIndex = start + i;
              const filled = absoluteIndex < ready;
              return (
                <View key={i} style={{ width: 4, height: 18, marginRight: 2, backgroundColor: filled ? '#16a34a' : (dark ? '#374151' : '#D1D5DB'), borderRadius: 2 }} />
              );
            })}
            {/* if group is full 5, add a slash mark to represent the tally group */}
            {groupCount === 5 && <Text style={{ marginLeft: 4, color: muted }}>/</Text>}
          </View>
        );
      }
      if (items.length === 0) return <Text style={{ color: muted }}>0</Text>;
      return <View style={{ flexDirection: 'row', alignItems: 'center' }}>{items}</View>;
    };

    // Decorations per variant
    const renderVariantDecor = () => {
      if (styleVariant === 'fold') {
        return (
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, width: 36, height: 36, zIndex: 6 }}>
            <View style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, backgroundColor: '#FFF3B0', transform: [{ rotate: '45deg' }], borderRadius: 3, elevation: 2 }} />
          </View>
        );
      }
      if (styleVariant === 'spiral') {
        return (
          <View pointerEvents="none" style={{ position: 'absolute', top: 6, left: '50%', transform: [{ translateX: -40 }], flexDirection: 'row', zIndex: 6 }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <View key={i} style={{ width: 6, height: 10, borderRadius: 3, backgroundColor: '#bdbdbd', marginHorizontal: 4 }} />
            ))}
          </View>
        );
      }
      if (styleVariant === 'torn') {
        return (
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 10, flexDirection: 'row', justifyContent: 'space-between', zIndex: 6 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <View key={i} style={{ width: 8, height: 10, backgroundColor: i % 2 === 0 ? '#FFF9C4' : '#fff', transform: [{ translateY: 0 }] }} />
            ))}
          </View>
        );
      }
      if (styleVariant === 'sticker') {
        return (
          <View pointerEvents="none" style={{ position: 'absolute', top: 8, left: 8, zIndex: 6 }}>
            <View style={{ backgroundColor: '#FFECB3', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#F4C542' }}>
              <Text style={{ fontSize: 10, color: '#6b4f00', fontWeight: '700' }}>PRIO</Text>
            </View>
          </View>
        );
      }
      if (styleVariant === 'comic' || styleVariant === 'sketch') {
        return (
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 6 }}>
            {/* rough hand-drawn outline (multiple slightly-offset strokes) */}
            <View style={{ position: 'absolute', left: 6, right: 6, top: 6, bottom: 6, borderRadius: 6, borderWidth: 1, borderColor: '#b08900', transform: [{ rotate: '-1deg' }], opacity: 0.9 }} />
            <View style={{ position: 'absolute', left: 4, right: 8, top: 8, bottom: 4, borderRadius: 6, borderWidth: 1, borderColor: '#d4b35a', transform: [{ rotate: '1deg' }], opacity: 0.6 }} />
            {/* small doodle in top-right */}
            <View style={{ position: 'absolute', top: 10, right: 10, width: 22, height: 18, zIndex: 8 }}>
              <View style={{ position: 'absolute', left: 2, top: 2, width: 18, height: 2, backgroundColor: '#b08900', transform: [{ rotate: '18deg' }], borderRadius: 2 }} />
              <View style={{ position: 'absolute', left: 0, top: 8, width: 18, height: 2, backgroundColor: '#b08900', transform: [{ rotate: '-12deg' }], borderRadius: 2 }} />
            </View>
          </View>
        );
      }
      return null;
    };

    

    return (
      <View style={{ marginBottom: idx < 999 ? 5 : 0, position: 'relative' }}>
        {/* Notepad-style container - outer frame */}
        <View style={{ position: 'relative', borderRadius: 4, overflow: 'hidden' }}>
          {/* background image that must cover the whole frame */}
          {(dark ? comandaSimpleDark : comandaSimpleLight) && (
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              <Image source={dark ? comandaSimpleDark : comandaSimpleLight} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, width: '100%', height: '100%' }} resizeMode="cover" />
            </View>
          )}
          {/* inner content box (transparent background so image shows through) */}
          <View style={{
            backgroundColor: 'transparent',
            padding: 12,
            paddingTop: 0,
            paddingBottom: 0,
            borderWidth: 1,
            borderColor: dark ? '#374151' : '#E5E7EB'
          }}>

            {/* border overlay for blink (absolute so content doesn't pulse) */}
            <Animated.View
                pointerEvents="none"
              style={{
                position: 'absolute',
                left: -3,
                right: -3,
                top: -3,
                bottom: -3,
                borderRadius: 10,
                borderWidth: 4,
                borderColor: '#16a34a',
                opacity: borderAnim,
                zIndex: 4,
              }}
            />

            {/* Grid overlay removed: keep an empty, non-interactive layer for future visual helpers if needed */}
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 3 }} />

            <TouchableOpacity onPress={handlePress} style={{ paddingBottom: 0, zIndex: 10, minHeight: 120 }}>
              {/* Definitive layout: medir la altura real y dividir en 5 filas; cada fila tiene una altura fija
                  y su contenido se alinea abajo (justifyContent: 'flex-end') para asegurar que Bebidas y Comidas
                  queden siempre ligeramente hacia abajo, independientemente del dispositivo. */}
              <View
                onLayout={(e) => {
                  const h = Math.round(e.nativeEvent.layout.height || 0);
                  if (h && gridHeightsRef.current[comanda.id] !== h) {
                    gridHeightsRef.current = { ...(gridHeightsRef.current || {}), [comanda.id]: h };
                    // bump state to force rerender only when measurement changes
                    setGridKey((k) => k + 1);
                  }
                }}
                style={{ flexDirection: 'column', width: '100%', minHeight: 120 }}
              >
                {(() => {
                  const measured = gridHeightsRef.current && gridHeightsRef.current[comanda.id];
                  const total = measured && measured > 0 ? measured : 120;
                  const rowH = Math.max(1, Math.round(total / 5));
                  // Move Bebidas and Comidas rows up by 3% of the total comanda height
                  const offsetCat = Math.round(total * 0.03);
                  return (
                    <View key={`rows-wrapper-${comanda.id}-${gridKey}`}>
                      {Array.from({ length: 5 }).map((_, rowIndex) => {
                        const isCategoryRow = rowIndex === 3 || rowIndex === 4;
                        const rowTransform = isCategoryRow ? [{ translateY: -9 }] : undefined;
                        return (
                          <View key={`row-${rowIndex}`} style={{ height: rowH, flexDirection: 'row' }}>
                            {/* LEFT column: align content at bottom of the row */}
                            <View style={{ flex: 65, justifyContent: 'flex-end', paddingLeft: '4%', alignItems: 'flex-start', transform: rowTransform }}>
                              {rowIndex === 0 && (
                                estaEntregada ? (
                                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center' }}>
                                      <Text style={{ color: 'white', fontSize: 12, fontWeight: '700' }}>✓</Text>
                                    </View>
                                  </View>
                                ) : (
                                  <Text style={{ fontSize: 10, color: timeColor, textAlign: 'left', includeFontPadding: false, lineHeight: 14, transform: [{ translateY: -2 }, { translateX: 2 }] }}>{formatTiempo(comanda.createdAt || comanda.created_at)}</Text>
                                )
                              )}
                              {rowIndex === 3 && bebidas.length > 0 && (
                                <Animated.Text style={{ fontSize: 15, color: bebidasAllReady ? '#16a34a' : fg, opacity: bebidasBlink, textAlign: 'left', flexShrink: 1, flexWrap: 'nowrap', includeFontPadding: false, fontFamily: 'HelloValentina', lineHeight: 18 }}>{`Bebidas`}</Animated.Text>
                              )}
                              {rowIndex === 4 && comidas.length > 0 && (
                                <Animated.Text style={{ fontSize: 15, color: comidasAllReady ? '#16a34a' : fg, opacity: comidasBlink, textAlign: 'left', flexShrink: 1, flexWrap: 'nowrap', includeFontPadding: false, fontFamily: 'HelloValentina', lineHeight: 18 }}>{`Comidas`}</Animated.Text>
                              )}
                            </View>

                            {/* RIGHT column: align content at bottom of the row */}
                            <View style={{ flex: 35, justifyContent: 'flex-end', paddingHorizontal: 0, alignItems: 'flex-end', transform: rowTransform }}>
                              {rowIndex === 0 && (
                                <Text style={{ fontSize: 11, color: fg, textAlign: 'right', includeFontPadding: false, lineHeight: 14, fontWeight: '700' }}>{`${idx + 1}`}</Text>
                              )}
                              {rowIndex === 3 && bebidas.length > 0 && (
                                <Animated.View style={{ opacity: bebidasBlink, alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'flex-end', transform: [{ translateX: 2 }] }}>{renderPalitosText(bebidas.length, bebidasReady, 10)}</Animated.View>
                              )}
                              {rowIndex === 4 && comidas.length > 0 && (
                                <Animated.View style={{ opacity: comidasBlink, alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'flex-end', transform: [{ translateX: 2 }] }}>{renderPalitosText(comidas.length, comidasReady, 10)}</Animated.View>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  );
                })()}
              </View>
            </TouchableOpacity>
            {/* Hint hand prompting touch when ready and not delivered */}
            {showHint && (
              <Animated.View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  zIndex: 6,
                  transform: [{ translateY: bounceAnim }],
                }}
              >
                <Text style={{ fontSize: 26 }}>👆🏽</Text>
              </Animated.View>
            )}
          </View>
        </View>
      </View>
    );
  };

  useEffect(() => {
    requestLoad();

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

    // Conectar al socket para actualizaciones en tiempo real
    let socket = getSocket();
    try {
      const token = useAuthStore.getState().token;
      socket = (!socket || !socket.connected) ? (token ? createSocket(token) : createSocket()) : socket;
    } catch {}
    if (socket) {
      // Registrar usuario para direccionamiento de eventos
      try {
        if (user?.id && user?.tipo) {
          socket.emit('register', { userId: String(user.id), userType: String(user.tipo) });
        }
      } catch {}
      const rooms = [
        user?.localId ? `atencion:${user.localId}` : 'atencion',
        user?.localId ? `bar:${user.localId}` : 'bar',
        user?.localId ? `cocina:${user.localId}` : 'cocina',
      ];
      if (socket.connected) {
        rooms.forEach((r) => socket.emit('join-room', r));
      } else {
        socket.once('connect', () => {
          rooms.forEach((r) => socket.emit('join-room', r));
        });
      }

      socket.on('pedido-listo', () => {
        requestLoad();
      });

      // Broaden listeners: catch various pedido updates
      socket.on('pedido-actualizado', () => {
        requestLoad();
      });
      socket.on('pedido-cambiado-estado', () => {
        requestLoad();
      });
      socket.on('pedido', () => {
        requestLoad();
      });
      // Fallback: any event whose name contains 'pedido'
      try {
        if ((socket as any).onAny) {
          (socket as any).onAny((event: string, ...args: any[]) => {
            // Debug: log events to identify exact names coming from backend
            console.log('[mesero][socket] event', event);
            if (/pedido/i.test(event) || /comanda/i.test(event)) {
              requestLoad();
            }
          });
        }
      } catch {}

      socket.on('comanda-actualizada', () => {
        requestLoad();
      });

      socket.on('comanda-completa', () => {
        requestLoad();
      });

      socket.on('comanda-entregada', () => {
        requestLoad();
      });

      return () => {
        socket.off('pedido-listo');
        socket.off('pedido-actualizado');
        socket.off('pedido-cambiado-estado');
        socket.off('pedido');
        try { if ((socket as any).offAny) { (socket as any).offAny(); } } catch {}
        socket.off('comanda-actualizada');
        socket.off('comanda-completa');
        socket.off('comanda-entregada');
        // leave joined rooms
        try { rooms.forEach((r) => socket.emit('leave-room', r)); } catch {}
      };
    }
  }, [showModal, (user as any)?.photo, (user as any)?.fotoUrl, (user as any)?.foto, modalHandAnim]);

  const modalHandTransform = (modalHandAnim && typeof (modalHandAnim as any).interpolate === 'function')
    ? [{ translateX: modalHandAnim.interpolate({ inputRange: [0, 1], outputRange: [-60, 60] }) }]
    : undefined;

  // Separar mesas con comandas abiertas y mesas libres
  const { mesasConComandas, mesasLibres } = useMemo(() => {
    const con = (mesas || []).filter((m) => (m.comandas || []).some((c: any) => c && (c.estado === 'abierta' || (c.estado === 'cerrada' && c.entregado === true))));
    const libres = (mesas || []).filter((m) => !(m.comandas && m.comandas.length > 0));
    return { mesasConComandas: con, mesasLibres: libres } as { mesasConComandas: MesaConComanda[]; mesasLibres: MesaConComanda[] };
  }, [mesas, tiempoActual]);

  // Marcar comanda como entregada (persist via backend)
  const marcarComandaEntregada = async (comandaId: string) => {
    try {
      // Optimistic: show check immediately and trigger animation
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setDeliveredOptimistic(prev => new Set(prev).add(String(comandaId)));
      // Fire a load to reorder as soon as possible
      requestLoad();
      // Persist to backend (non-blocking for UI)
      await comandaService.marcarEntregada(comandaId);
    } catch (err) {
      console.error('[Mesero] error marcando comanda entregada ->', err);
      Alert.alert('Error', 'No se pudo marcar la comanda como entregada');
    }
  };

  const getEmojiPorTipo = (key?: string) => {
    if (!key) return '';
    const t = (key || '').toString().toLowerCase();
    // tolerant pizza matching (pizza, pizzas, pizz.. etc.)
    if (/pizz/i.test(t)) return '🍕';
    if (t.includes('comida') || t.includes('food') || t.includes('dish')) return '🍔';
    if (t.includes('bebida') || t.includes('drink') || t.includes('bar')) return '🍹';
    return '🍽️';
  };

  // Componente para pedido con animación de parpadeo (se silencia si la comanda completa está lista)
  const PedidoChip = ({ pedido, dark, fg, comandaReady = false }: any) => {
    const listo = pedido.estado === 'listo';
    // si la comanda completa está lista, no queremos que los pedidos individuales parpadeen,
    // solo el borde de la comanda parpadeará.
    const shouldBlink = listo && !comandaReady;
    const fadeAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      if (shouldBlink) {
        const blink = Animated.loop(
          Animated.sequence([
            // parpadeo por pedido más relajado (más lento)
            Animated.timing(fadeAnim, {
              toValue: 0.3,
              duration: 2400,
              useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 2400,
              useNativeDriver: true,
            }),
          ])
        );
        blink.start();
        return () => blink.stop();
      } else {
        // Asegurarnos que quede opacidad 1 cuando no debe parpadear
        fadeAnim.setValue(1);
      }
    }, [shouldBlink, fadeAnim]);

    // prefer the product category first so 'Pizzas' wins over generic tipo='comida'
    const key = pedido.producto?.categoria || pedido.producto?.tipo || pedido.producto?.nombre;
    const emoji = getEmojiPorTipo(key);

    return (
      <Animated.View
        style={{
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 4,
          borderWidth: 1,
          backgroundColor: listo 
            ? '#10b981' 
            : (dark ? '#1F2937' : '#F3F4F6'),
          borderColor: listo 
            ? '#059669' 
            : (dark ? '#4B5563' : '#D1D5DB'),
          opacity: shouldBlink ? fadeAnim : 1,
        }}
      >
        <Text style={{ fontSize: 11, color: listo ? 'white' : fg, fontWeight: listo ? '600' : '400' }}>
          {emoji} {pedido.cantidad}x {pedido.producto?.nombre || 'Producto'}
        </Text>
        {pedido.notas ? (
          <View style={{ marginTop: 6, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(245, 158, 11, 0.12)' }}>
            <Text style={{ color: '#92400E', fontWeight: '700', fontSize: 11 }}>{pedido.notas}</Text>
          </View>
        ) : null}
      </Animated.View>
    );
  };

  // --- Helpers y componentes auxiliares ---
  const formatTiempo = (d?: string | Date | number | null) => {
    try {
      const ms = d ? (typeof d === 'number' ? d : new Date(d).getTime()) : Date.now();
      const minutes = Math.max(0, Math.floor((Date.now() - ms) / 60000));
      return `${minutes}m`;
    } catch (e) {
      return '-';
    }
  };

  // Graphical progressive-square palitos (4 sides + diagonal) scaled by fontSize.
    const renderPalitos = (count: number, ready: number, fontSize: number = 12) => {
      const groups = Math.ceil(Math.max(0, count) / 5);
      const items: any[] = [];
      const glyph = Math.max(12, Math.round(fontSize * 1.6));
      // reduced stroke multiplier and allow 1px minimum for a slimmer look
      const stroke = Math.max(1, Math.round(fontSize * 0.14));
      const diagWidth = Math.max(Math.round(glyph * 1.1), glyph + 6);
      for (let g = 0; g < groups; g++) {
        const start = g * 5;
        const groupCount = Math.min(5, Math.max(0, count - start));
        const strokeColor = (i: number) => ((start + i) < ready) ? '#16a34a' : (dark ? '#FFFFFF' : '#000');

        items.push(
          <View key={`g${g}`} style={{ width: glyph, height: glyph, marginRight: Math.round(fontSize * 0.5), position: 'relative' }}>
            {groupCount >= 1 && <View style={{ position: 'absolute', left: Math.max(1, Math.round(stroke / 2)), top: Math.round(glyph * 0.12), bottom: Math.round(glyph * 0.12), width: stroke, backgroundColor: strokeColor(0), borderRadius: stroke / 2 }} />}
            {groupCount >= 2 && <View style={{ position: 'absolute', left: Math.round(glyph * 0.12), right: Math.round(glyph * 0.12), top: Math.max(1, Math.round(stroke / 2)), height: stroke, backgroundColor: strokeColor(1), borderRadius: stroke / 2 }} />}
            {groupCount >= 3 && <View style={{ position: 'absolute', right: Math.max(1, Math.round(stroke / 2)), top: Math.round(glyph * 0.12), bottom: Math.round(glyph * 0.12), width: stroke, backgroundColor: strokeColor(2), borderRadius: stroke / 2 }} />}
            {groupCount >= 4 && <View style={{ position: 'absolute', left: Math.round(glyph * 0.12), right: Math.round(glyph * 0.12), bottom: Math.max(1, Math.round(stroke / 2)), height: stroke, backgroundColor: strokeColor(3), borderRadius: stroke / 2 }} />}
            {groupCount >= 5 && (
              <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
                <View style={{ width: diagWidth, height: stroke, backgroundColor: strokeColor(4), transform: [{ rotate: '-45deg' }], borderRadius: stroke / 2 }} />
              </View>
            )}
          </View>
        );
      }
      if (items.length === 0) return <Text style={{ color: dark ? 'white' : '#111827', fontSize }}>{0}</Text>;
      return <View style={{ flexDirection: 'row', alignItems: 'center' }}>{items}</View>;
    };

  // Backwards-compatible textual API: delegate to graphical renderer (scaled)
  const renderPalitosText = (count: number, ready: number, fontSize: number = 12) => {
    return renderPalitos(count, ready, fontSize);
  };

  const isBebidaProducto = (producto?: any) => {
    if (!producto) return false;
    // Prefer explicit tipo field when present
    const tipo = (producto.tipo || producto?.type || '').toString().toLowerCase();
    if (tipo === 'bebida' || tipo === 'drink') return true;
    if (tipo === 'comida' || tipo === 'food') return false;
    const text = ((producto.nombre || producto.categoria || producto.tipo) || '').toString().toLowerCase();
    return /bebid|drink|bar|cerveza|vino|coctel|cocktail|trago|refresco|cafe|tea/i.test(text);
  };

  const getAgeColor = (minutes: number) => {
    // <=5 min: green, >5 && <=8: yellow, >8: red
    if (minutes <= 5) return '#16a34a';
    if (minutes <= 8) return '#f59e0b';
    return '#ef4444';
  };

  const normalizePhotoUri = (candidate: any) => {
    try {
      if (!candidate) return null;
      let normalized = candidate;
      if (typeof normalized === 'object' && normalized.uri) normalized = normalized.uri;
      if (typeof normalized !== 'string') return null;
      if (/^https?:\/\//i.test(normalized) || /^data:/i.test(normalized) || /^file:/i.test(normalized) || /^content:/i.test(normalized)) return normalized;
      const rawApi = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000').toString().trim();
      const host = rawApi.replace(/\/api\/v1\/?$/i, '').replace(/\/+$/, '');
      const leading = normalized.startsWith('/') ? '' : '/';
      return `${host}${leading}${normalized}`;
    } catch (err) {
      return null;
    }
  };

  const navLockRef = useRef(false);
  const onAbrirComanda = (mesa: any) => {
    if (navLockRef.current) return;
    navLockRef.current = true;
    try {
      router.push(`/mesero/mesa/${mesa.id}`);
    } catch (e) {
      console.error('Error navegando a la comanda', e);
    }
    setTimeout(() => { navLockRef.current = false; }, 600);
  };
  // Track last tap per mesa to avoid double opens
  const lastMesaTapRef = useRef<Record<string, number>>({});

  // Emoji background that sizes to the parent box
  const EmojiBackground = ({ symbol, opacity = 0.36 }: { symbol: string; opacity?: number }) => {
    const [dim, setDim] = useState({ w: 0, h: 0 });
    const lastDim = useRef({ w: 0, h: 0 });

    const fontSize = Math.floor(Math.min(dim.w || 72, dim.h || 72) * 0.7);

    const onLayout = (e: any) => {
      const w = Math.round(e.nativeEvent.layout.width || 0);
      const h = Math.round(e.nativeEvent.layout.height || 0);
      // only update when size changed meaningfully to avoid jitter caused by transient layout updates
      if (Math.abs(w - lastDim.current.w) > 2 || Math.abs(h - lastDim.current.h) > 2) {
        lastDim.current = { w, h };
        setDim({ w, h });
      }
    };

    return (
      <View
        pointerEvents="none"
        onLayout={onLayout}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 0 }}
      >
        <Text style={{ fontSize: fontSize || 48, opacity: opacity, includeFontPadding: false }}>{symbol}</Text>
      </View>
    );
  };

  const ComandaSummary = ({ comanda, index }: { comanda: any; index: number }) => {
    const [bebidasBlink] = useState(() => new Animated.Value(1));
    const [comidasBlink] = useState(() => new Animated.Value(1));

    const pedidos = comanda?.pedidos || [];
    const bebidas = pedidos.filter((p: any) => isBebidaProducto(p.producto));
    const comidas = pedidos.filter((p: any) => !isBebidaProducto(p.producto));
    const bebidasReady = bebidas.filter((p: any) => p.estado === 'listo').length;
    const comidasReady = comidas.filter((p: any) => p.estado === 'listo').length;

    const bebidasAllReady = bebidas.length > 0 && bebidasReady === bebidas.length;
    const comidasAllReady = comidas.length > 0 && comidasReady === comidas.length;

    useEffect(() => {
      if (bebidasAllReady) {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(bebidasBlink, { toValue: 0.3, duration: 600, useNativeDriver: true }),
            Animated.timing(bebidasBlink, { toValue: 1, duration: 600, useNativeDriver: true }),
          ])
        );
        loop.start();
        return () => loop.stop();
      } else {
        bebidasBlink.setValue(1);
      }
    }, [bebidasAllReady, bebidasBlink]);

    useEffect(() => {
      if (comidasAllReady) {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(comidasBlink, { toValue: 0.3, duration: 600, useNativeDriver: true }),
            Animated.timing(comidasBlink, { toValue: 1, duration: 600, useNativeDriver: true }),
          ])
        );
        loop.start();
        return () => loop.stop();
      } else {
        comidasBlink.setValue(1);
      }
    }, [comidasAllReady, comidasBlink]);

    const minutes = comanda ? Math.max(0, Math.floor((Date.now() - new Date(comanda.createdAt || comanda.created_at).getTime()) / 60000)) : 0;
    const timeColor = getAgeColor(minutes);

    return (
      <View style={{ marginBottom: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
          <View style={{ backgroundColor: timeColor, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
            <Text style={{ color: 'white', fontWeight: '700', fontSize: 11 }}>{`C${index + 1}`}</Text>
          </View>
          <Text style={{ marginLeft: 8, fontSize: 12, color: muted }}>{minutes}m</Text>
        </View>

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1, padding: 6, borderRadius: 6, borderWidth: 1, borderColor: comidasAllReady ? '#16a34a' : (dark ? '#263244' : '#E5E7EB'), position: 'relative', overflow: 'hidden' }}>
              <View style={{ zIndex: 2 }}>
                {renderPalitosText(comidas.length, comidasReady, 12)}
              </View>
              <EmojiBackground symbol={'🍽️'} opacity={0.38} />
              {/* animated indicator dot for comidas (doesn't affect emoji/background) */}
              <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 8, right: 8, width: 12, height: 12, borderRadius: 6, backgroundColor: comidasAllReady ? '#16a34a' : (dark ? '#374151' : '#D1D5DB'), opacity: comidasBlink, zIndex: 3 }} />
            </View>

            <View style={{ flex: 1, padding: 6, borderRadius: 6, borderWidth: 1, borderColor: bebidasAllReady ? '#16a34a' : (dark ? '#263244' : '#E5E7EB'), position: 'relative', overflow: 'hidden' }}>
              <View style={{ zIndex: 2 }}>
                {renderPalitosText(bebidas.length, bebidasReady, 12)}
              </View>
              <EmojiBackground symbol={'🍹'} opacity={0.38} />
              {/* animated indicator dot for bebidas (doesn't affect emoji/background) */}
              <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 8, right: 8, width: 12, height: 12, borderRadius: 6, backgroundColor: bebidasAllReady ? '#16a34a' : (dark ? '#374151' : '#D1D5DB'), opacity: bebidasBlink, zIndex: 3 }} />
            </View>
          </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 0 }}>
          <Text style={{ fontSize: 14, color: comanda.entregado ? '#16a34a' : muted }}>{comanda.entregado ? '✓' : ''}</Text>
          <Text style={{ fontSize: 14, color: comanda.estado === 'cerrada' ? '#16a34a' : muted }}>{comanda.estado === 'cerrada' ? '$' : ''}</Text>
        </View>
      </View>
    );
  };

    

  const GridMesa = ({ mesa, containerStyle }: { mesa: MesaConComanda; containerStyle?: any }) => {
    const comandas = (mesa.comandas || []).filter((c: any) => c);
    const mostrarComandas = comandas.slice(0, 2);

    // Para mesas vacías: solo View con botón interno (sin TouchableOpacity wrapper)
    if (mostrarComandas.length === 0) {
      return (
        <View style={[containerStyle, { padding: 4 }]}>
          <View style={{ backgroundColor: dark ? '#0b1220' : '#FFFFFF', borderRadius: 8, padding: 8, flex: 1, borderWidth: 1, borderColor: dark ? '#1F2937' : '#E5E7EB' }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: fg, marginBottom: 6 }}>{mesa.nombre || `Mesa ${mesa.numero}`}</Text>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <Pressable 
                onPress={() => {
                  console.log('[GridMesa] ✅ PRESS DETECTADO en botón +, mesa:', mesa.id);
                  onAbrirComanda(mesa);
                }}
                onPressIn={() => console.log('[DEBUG] PressIn en botón +, mesa:', mesa.id)}
                onPressOut={() => console.log('[DEBUG] PressOut en botón +, mesa:', mesa.id)}
                style={({ pressed }) => ([
                  { 
                    width: 80, 
                    height: 80, 
                    borderRadius: 12, 
                    backgroundColor: PRIMARY, 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    opacity: pressed ? 0.7 : 1
                  }
                ])}
                accessibilityLabel={`Nueva comanda ${mesa.nombre || mesa.numero}`}
              >
                <Text style={{ color: 'white', fontSize: 40, fontWeight: '700' }}>+</Text>
              </Pressable>
            </View>
          </View>
        </View>
      );
    }

    // Para mesas con comandas: mantener TouchableOpacity solo en comandas individuales
    return (
      <View style={[containerStyle, { padding: 4 }]}>
        <View style={{ backgroundColor: dark ? '#0b1220' : '#FFFFFF', borderRadius: 8, padding: 8, flex: 1, borderWidth: 1, borderColor: dark ? '#1F2937' : '#E5E7EB' }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: fg, marginBottom: 6 }}>{mesa.nombre || `Mesa ${mesa.numero}`}</Text>
          {mostrarComandas.map((c: any, idx: number) => (
            <ComandaRow
              key={c.id || idx}
              comanda={c}
              idx={idx}
              dark={dark}
              fg={fg}
              onOpen={() => {
                console.log('[GridMesa] ✅ PRESS DETECTADO en comanda, mesa:', mesa.id, 'comandaId:', c.id);
                onAbrirComanda(mesa);
              }}
              estaEntregada={!!c.entregado || deliveredOptimistic.has(String(c.id))}
              onMarcarEntregada={() => marcarComandaEntregada(c.id)}
            />
          ))}
        </View>
      </View>
    );
  };

  // --- Fin helpers ---

  // Función auxiliar para verificar si una fecha es del mismo día
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

  // Grid packing: each comanda occupies one slot. rowsNeeded = comandas.length (or 1 if none).
  // We pack row-major into `cols` columns and `rows` rows. Sort mesas per business rules.
  const packGrid = (mesasList: MesaConComanda[], cols = 3, rows = 4) => {
    const placements: any[] = [];
    const overflow: MesaConComanda[] = [];
    if (!Array.isArray(mesasList) || mesasList.length === 0) return { placements, overflow };

    // Order mesas: pending oldest first, then delivered (not paid), then paid, then empty
    const getMesaOrder = (m: any) => {
      const cs = (m.comandas || []).filter((c: any) => c);
      if (cs.length === 0) return { group: 3, time: Number.POSITIVE_INFINITY };
      // categorize
      const pending = cs.filter((c: any) => c.estado === 'abierta' && !c.entregado);
      const delivered = cs.filter((c: any) => (c.estado === 'abierta' || c.estado === 'cerrada') && c.entregado);
      const paid = cs.filter((c: any) => (c.estado === 'cerrada'));
      if (pending.length > 0) {
        const times = pending.map((c: any) => new Date(c.createdAt || c.created_at).getTime()).filter(Boolean);
        return { group: 0, time: times.length ? Math.min(...times) : Number.POSITIVE_INFINITY };
      }
      if (delivered.length > 0) {
        const times = delivered.map((c: any) => new Date(c.createdAt || c.created_at).getTime()).filter(Boolean);
        return { group: 1, time: times.length ? Math.min(...times) : Number.POSITIVE_INFINITY };
      }
      if (paid.length > 0) {
        const times = paid.map((c: any) => new Date(c.createdAt || c.created_at).getTime()).filter(Boolean);
        return { group: 2, time: times.length ? Math.min(...times) : Number.POSITIVE_INFINITY };
      }
      return { group: 3, time: Number.POSITIVE_INFINITY };
    };

    const list = mesasList.slice().sort((a: any, b: any) => {
      const A = getMesaOrder(a);
      const B = getMesaOrder(b);
      if (A.group !== B.group) return A.group - B.group;
      return A.time - B.time;
    });

    const occupied = Array.from({ length: cols }, () => Array(rows).fill(false));

    for (const mesa of list) {
      const comandasCount = Math.max(1, (mesa.comandas || []).length);
      let rowsNeeded = Math.min(rows, comandasCount);
      let placed = false;
      // Scan row-major: for each row from top to bottom, try columns left-to-right
      for (let r = 0; r <= rows - rowsNeeded && !placed; r++) {
        for (let c = 0; c < cols && !placed; c++) {
          let ok = true;
          for (let k = 0; k < rowsNeeded; k++) {
            if (occupied[c][r + k]) { ok = false; break; }
          }
          if (ok) {
            for (let k = 0; k < rowsNeeded; k++) occupied[c][r + k] = true;
            placements.push({ mesa, col: c, row: r, rows: rowsNeeded });
            placed = true;
          }
        }
      }
      if (!placed) overflow.push(mesa);
    }

    return { placements, overflow };
  };

  const gridData = useMemo(() => {
    const cols = 3;
    const totalSlots = Math.max(3, (mesas || []).length * 2);
    const rows = Math.max(1, Math.ceil(totalSlots / cols));

    const initialGridHeight = Math.max(4 * 120, Math.round(window.height * 0.6));
    const measured: Record<string, number> = (gridHeightsRef.current || {});

    // compute required cell height so that for any mesa: rowsNeeded * cellH >= header + sum(comandaHeights)
    const headerH = 35; // approximate header height for the mesa (title + margins)
    const defaultComandaH = 120;
    const singleComandaH = 120; // height for mesas with just one comanda
    let maxRequiredPerSlot = 175; // minimum height for empty mesas (header + 1 comanda + padding)

    for (const mesa of (mesas || [])) {
      const comandas = (mesa.comandas || []).slice(0, 10);
      
      const heights = comandas.map((c: any) => measured[c?.id] || (comandas.length === 1 ? singleComandaH : 120));
      const sumComandas = heights.reduce((s: number, x: number) => s + x, 0);
      const rowsNeeded = Math.max(1, comandas.length);
      const requiredPerSlot = Math.ceil((headerH + sumComandas) / rowsNeeded);
      if (requiredPerSlot > maxRequiredPerSlot) maxRequiredPerSlot = requiredPerSlot;
    }

    const cellH = Math.max(100, Math.ceil(maxRequiredPerSlot));
    const containerHeight = rows * cellH;

    const { placements, overflow } = packGrid(mesas || [], cols, rows);
    return { placements, overflow, cols, rows, cellH, containerHeight };
  }, [mesas, gridKey, gridLayout]);

  const renderMesaConComanda = (mesa: MesaConComanda) => {
    // Mostrar comandas abiertas y además comandas cerradas+entregadas del mismo día
    const comandasAbiertas = (mesa.comandas || []).filter((c: any) => c.estado === 'abierta' || (c.estado === 'cerrada' && c.entregado === true && isSameDay((c as any).cerradaAt)));
    const todasComandasEntregadas = (mesa.comandas || []).length > 0 && (mesa.comandas || []).every((c: any) => c.entregado === true);
    
    return (
      <TouchableOpacity
        onPress={() => onAbrirComanda(mesa)}
        key={mesa.id}
        style={{
          marginBottom: 5,
          borderRadius: 8,
          overflow: 'hidden',
          borderWidth: 2,
          borderColor: todasComandasEntregadas ? '#16a34a' : (dark ? '#374151' : '#E5E7EB'),
        }}
      >
        {/* Avatares de meseros asignados en la esquina superior derecha (mobile) */}
            {mesa.usuariosAsignados && mesa.usuariosAsignados.length > 0 && (
          <View style={{ position: 'absolute', top: 6, right: 8, zIndex: 50, flexDirection: 'row' }}>
            {mesa.usuariosAsignados.slice(0,3).map((u: any, idx: number) => {
              const isMe = String(u.id) === String(user?.id);
              return u.foto ? (
                <Image key={u.id} source={{ uri: u.foto }} style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: isMe ? PRIMARY : 'white', marginLeft: idx === 0 ? 0 : -8 }} />
              ) : (
                <View key={u.id} style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginLeft: idx === 0 ? 0 : -8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700' }}>{(u.nombre || 'U').charAt(0).toUpperCase()}</Text>
                </View>
              );
            })}
          </View>
        )}
        {/* Botón de mesa vertical a la izquierda */}
        <View style={{ flexDirection: 'row', minHeight: 100 }}>
          <View
            style={{
              width: 60,
              backgroundColor: todasComandasEntregadas ? '#16a34a' : (dark ? '#1F2937' : '#F3F4F6'),
              borderRightWidth: 2,
              borderRightColor: todasComandasEntregadas ? '#16a34a' : (dark ? '#4B5563' : '#D1D5DB'),
              alignItems: 'center',
              justifyContent: 'center',
              padding: 8,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: todasComandasEntregadas ? 'white' : fg,
                transform: [{ rotate: '0deg' }],
                textAlign: 'center',
              }}
            >
              {mesa.nombre || `Mesa ${mesa.numero}`}
            </Text>
          </View>

          {/* Comandas */}
          <View style={{ flex: 1, backgroundColor: dark ? '#1F2937' : '#F9FAFB', padding: 8 }}>
            {/* Comandas abiertas - normales */}
            {comandasAbiertas.filter((c: any) => c.estado !== 'cerrada').map((comanda: any, idx: number) => {
              const yaEntregada = !!comanda.entregado || deliveredOptimistic.has(String(comanda.id));
              return (
                <ComandaListRow
                  key={comanda.id}
                  comanda={comanda}
                  idx={idx}
                  dark={dark}
                  fg={fg}
                  onOpen={() => onAbrirComanda(mesa)}
                  estaEntregada={yaEntregada}
                  onMarcarEntregada={() => marcarComandaEntregada(comanda.id)}
                />
              );
            })}
            
            {/* Comandas cerradas - compactas en una línea */}
            {(() => {
              const cerradosHoy = comandasAbiertas.filter((c: any) => c.estado === 'cerrada');
              return (
                <>
                  {cerradosHoy.length > 0 && (
                    <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {cerradosHoy.map((comanda: any) => (
                        <TouchableOpacity 
                          key={comanda.id}
                          onPress={() => onAbrirComanda(mesa)}
                          style={{ 
                            paddingHorizontal: 10, 
                            paddingVertical: 6, 
                            backgroundColor: dark ? '#064e3b' : '#dcfce7',
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: '#16a34a',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 6
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: '700', color: dark ? '#FFFFFF' : '#111827' }}>Comanda {comanda.id?.toString().slice(0, 4)}</Text>
                          <Text style={{ fontSize: 12 }}>✓</Text>
                          {comanda.estado === 'cerrada' && (
                            <Text style={{ fontSize: 12 }}>$</Text>
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  
                  {/* Contador de comandas cerradas hoy */}
                  {cerradosHoy.length > 0 && (
                    <View style={{ marginTop: 6, paddingHorizontal: 8, paddingVertical: 4, alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: muted }}>
                        📋 {cerradosHoy.length} {cerradosHoy.length === 1 ? 'comanda cerrada' : 'comandas cerradas'} hoy
                      </Text>
                    </View>
                  )}
                </>
              );
            })()}
            
            {/* Texto para agregar nueva comanda */}
            {(comandasAbiertas.length === 0 || comandasAbiertas.filter((c: any) => c.estado !== 'cerrada').length === 0) && (
              <TouchableOpacity onPress={() => onAbrirComanda(mesa)} style={{ paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: muted }}>Toca para agregar comanda</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMesaLibre = (mesa: MesaConComanda) => (
    <TouchableOpacity
      key={mesa.id}
      onPress={() => onAbrirComanda(mesa)}
      style={{
        marginBottom: 5,
        padding: 12,
        borderRadius: 8,
        backgroundColor: dark ? '#1F2937' : 'white',
        borderWidth: 2,
        borderColor: dark ? '#4B5563' : '#D1D5DB',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '700', color: fg }}>
        {mesa.nombre || `Mesa ${mesa.numero}`}
      </Text>
      <Text style={{ fontSize: 12, color: muted }}>Sin comandas</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      {/* Top nav (uses cached rendering for base64 logos and centralised logout behaviour) */}
      <TopNav title="Mesero" localLogo={localLogo} onOpenSettings={() => setShowModal(true)} />

      <View style={{ padding: 16, paddingTop: 8 }}>
        {/* Botón para meseros: selector de vista (izq) + asignar mesas (der) */}
        {user?.tipo === 'atencion' && (
          <View style={{ marginBottom: 12, flexDirection: 'row', gap: 8 }}>
            <View style={{ width: '50%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
              {/* tightened emoji buttons: list (icon) + group (2x2 squares) */}
              <TouchableOpacity accessibilityLabel="Modo lista" onPress={() => setViewMode('list')} style={{ alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, backgroundColor: viewMode === 'list' ? PRIMARY : (dark ? '#1F2937' : '#F3F4F6'), borderWidth: viewMode === 'list' ? 0 : 1, borderColor: viewMode === 'list' ? PRIMARY : (dark ? '#374151' : '#E5E7EB') }}>
                <Text style={{ fontSize: 18, color: viewMode === 'list' ? 'white' : (dark ? 'white' : '#111827') }}>{'☰'}</Text>
              </TouchableOpacity>

              <TouchableOpacity accessibilityLabel="Modo agrupar" onPress={() => setViewMode('group')} style={{ alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8, borderRadius: 8, backgroundColor: viewMode === 'group' ? PRIMARY : (dark ? '#1F2937' : '#F3F4F6'), borderWidth: viewMode === 'group' ? 0 : 1, borderColor: viewMode === 'group' ? PRIMARY : (dark ? '#374151' : '#E5E7EB') }}>
                <Text style={{ fontSize: 18, color: viewMode === 'group' ? 'white' : (dark ? 'white' : '#111827') }}>{'▦'}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ width: '50%' }}>
              <TouchableOpacity onPress={openAssignModalMobile} style={{ backgroundColor: PRIMARY, paddingVertical: 10, borderRadius: 8, alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Asignar mesas</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {/* Botón para admin: alternar entre todas las mesas y solo asignadas */}
        {isAdmin && (
          <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity
              onPress={() => setVerSoloAsignadas(true)}
              style={{
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 6,
                    backgroundColor: verSoloAsignadas ? PRIMARY : (dark ? '#374151' : '#E5E7EB'),
                    borderWidth: 1,
                    borderColor: verSoloAsignadas ? PRIMARY : (dark ? '#4B5563' : '#D1D5DB'),
              }}
            >
              <Text style={{ 
                textAlign: 'center', 
                fontSize: 12, 
                fontWeight: '600',
                color: verSoloAsignadas ? 'white' : fg 
              }}>
                Mis mesas
              </Text>
            </TouchableOpacity>
            
                <TouchableOpacity
              onPress={() => setVerSoloAsignadas(false)}
              style={{
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 6,
                    backgroundColor: !verSoloAsignadas ? PRIMARY : (dark ? '#374151' : '#E5E7EB'),
                    borderWidth: 1,
                    borderColor: !verSoloAsignadas ? PRIMARY : (dark ? '#4B5563' : '#D1D5DB'),
              }}
            >
              <Text style={{ 
                textAlign: 'center', 
                fontSize: 12, 
                fontWeight: '600',
                color: !verSoloAsignadas ? 'white' : fg 
              }}>
                Todas
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 6, paddingTop: 16, paddingBottom: footerHeight + 32 }}>
        {viewMode === 'group' ? (
            // grid view: 3 cols x 4 rows packer - measure container and place mesas using absolute positioning
            (() => {
              const { placements = [], overflow = [], cols = 3, rows = 4, cellH = 120, containerHeight = Math.max(4 * 120, Math.round(window.height * 0.6)) } = gridData || {};
              const containerWidth = gridLayout?.width ?? Math.round(window.width - 24);
              const cellW = Math.max(1, Math.floor(containerWidth / (cols || 3)));

                const gutter = 3;
                return (
                <View style={{ width: '100%', paddingHorizontal: 2 }}>
                  <View
                    onLayout={(e) => {
                      const w = Math.round(e.nativeEvent.layout.width || 0);
                      const h = Math.round(e.nativeEvent.layout.height || 0);
                      if (!gridLayout || gridLayout.width !== w || gridLayout.height !== h) setGridLayout({ width: w, height: h });
                    }}
                    style={{ width: '100%', height: containerHeight, position: 'relative' }}
                  >
                    {placements.map((p: any) => {
                      const { mesa, col, row, rows: span } = p;
                      const left = col * cellW + gutter;
                      const top = row * cellH + gutter;
                      const w = cellW - (gutter * 2);
                      const h = span * cellH - (gutter * 2);
                      const comandas = (mesa.comandas || []).filter((c: any) => c);
                      const isEmpty = comandas.length === 0;
                      
                      // Contar comandas cerradas de hoy
                      const cerradosHoy = comandas.filter((c: any) => 
                        c.estado === 'cerrada' && 
                        c.entregado === true && 
                        isSameDay((c as any).cerradaAt)
                      ).length;
                      
                      // Calculate actual content height for better fit
                      const headerHeight = 35; // fixed header height
                      const comandaHeight = comandas.length === 1 ? 110 : (comandas.length > 1 ? 120 * comandas.length : 0);
                      const counterHeight = cerradosHoy > 0 ? 20 : 0; // height of counter if present
                      const paddingVertical = 8 * 2; // top + bottom padding
                      const paddingHorizontal = 2 * 2; // left + right padding from Pressable
                      const contentHeight = headerHeight + comandaHeight + counterHeight + paddingVertical + paddingHorizontal;
                      const actualHeight = Math.max(contentHeight, isEmpty ? 175 : 100); // minimum heights
                      
                      return (
                        <Pressable
                          key={mesa.id}
                          style={({ pressed }) => ([
                            { 
                              position: 'absolute', 
                              left, 
                              top, 
                              width: w, 
                              height: actualHeight, 
                              padding: 2,
                              opacity: pressed ? 0.7 : 1,
                              transform: [{ scale: pressed ? 0.98 : 1 }]
                            }
                          ])}
                          onPress={() => {
                            console.log('[Grid] ✅ PRESS mesa:', mesa.id);
                            onAbrirComanda(mesa);
                          }}
                        >
                          <View style={{ backgroundColor: dark ? '#0b1220' : '#FFFFFF', borderRadius: 8, padding: 8, flex: 1, borderWidth: 1, borderColor: dark ? '#1F2937' : '#E5E7EB' }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: fg, marginBottom: 6 }}>{mesa.nombre || `Mesa ${mesa.numero}`}</Text>
                            {isEmpty ? (
                              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ color: muted, fontSize: 14, textAlign: 'center' }}>Toca para agregar{`\n`}comanda +</Text>
                              </View>
                            ) : (
                              <View pointerEvents="none" style={{ flex: 1 }}>
                                <View style={{ flex: 1 }}>
                                  {comandas.slice(0, 2).map((c: any, idx: number) => (
                                    <View key={c.id || idx} style={{ marginBottom: 5, opacity: (!!c.entregado || deliveredOptimistic.has(String(c.id))) ? 1 : 1 }}>
                                      <ComandaRow
                                        comanda={c}
                                        idx={idx}
                                        dark={dark}
                                        fg={fg}
                                        onOpen={() => {}}
                                        estaEntregada={!!c.entregado || deliveredOptimistic.has(String(c.id))}
                                        onMarcarEntregada={() => marcarComandaEntregada(c.id)}
                                      />
                                    </View>
                                  ))}
                                </View>
                                
                                {/* Contador de comandas cerradas */}
                                {cerradosHoy > 0 && (
                                  <View style={{ marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: dark ? '#374151' : '#E5E7EB', alignItems: 'center' }}>
                                    <Text style={{ fontSize: 9, color: muted }}>
                                      📋 {cerradosHoy} {cerradosHoy === 1 ? 'cerrada' : 'cerradas'} hoy
                                    </Text>
                                  </View>
                                )}
                              </View>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>

                  {overflow && overflow.length > 0 && (
                    <View style={{ marginTop: 12 }}>
                      <Text style={{ color: muted }}>{`+${overflow.length} mesas adicionales`}</Text>
                    </View>
                  )}
                </View>
              );
            })()
        ) : (
          <>
            {/* Mesas con comandas */}
            {mesasConComandas.map(renderMesaConComanda)}

            {/* Mesas libres */}
            {mesasLibres.length > 0 && (
              <View style={{ marginTop: 16 }}>
                {mesasLibres.map(renderMesaLibre)}
              </View>
            )}

            {mesas.length === 0 && (
              <View style={{ padding: 24 }}>
                <Text style={{ textAlign: 'center', color: muted }}>No hay mesas asignadas</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

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

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <View style={{ backgroundColor: bg, borderRadius: 12, padding: 20, width: '90%', maxWidth: 400 }}>
            <TouchableOpacity onPress={() => setShowModal(false)} style={{ position: 'absolute', right: 12, top: 12, zIndex: 30 }}>
              <Text style={{ fontSize: 18, color: '#ef4444', fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              {user?.photo ? (
                <Image source={{ uri: user.photo }} style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 10 }} />
              ) : (
                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: dark ? '#374151' : '#E5E7EB', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <Text style={{ color: fg, fontSize: 32, fontWeight: '700' }}>{user?.nombre ? user.nombre.charAt(0).toUpperCase() : 'M'}</Text>
                </View>
              )}
              <Text style={{ fontSize: 20, fontWeight: '700', color: fg }}>{user?.nombre || 'Mesero'}</Text>
            </View>
            <View style={{ gap: 16 }}>
              <View>
                <Text style={{ color: muted, marginBottom: 6 }}>Nombre</Text>
                <TextInput
                  value={tempNombre}
                  onChangeText={setTempNombre}
                  placeholder="Tu nombre"
                  placeholderTextColor={muted}
                  style={{
                    borderWidth: 1,
                    borderColor: dark ? '#374151' : '#E5E7EB',
                    borderRadius: 8,
                    padding: 12,
                    color: fg,
                    backgroundColor: dark ? '#0b1220' : 'white'
                  }}
                />
                <TouchableOpacity onPress={() => { updateUser({ nombre: tempNombre }); setShowModal(false); }} style={{ marginTop: 8, backgroundColor: '#10b981', padding: 10, borderRadius: 8, alignItems: 'center' }}>
                  <Text style={{ color: 'white', fontWeight: '700' }}>Guardar Nombre</Text>
                </TouchableOpacity>
              </View>
              <View>
                <Text style={{ color: muted, marginBottom: 6 }}>Foto de Perfil</Text>
                <View style={{ flexDirection: 'row', gap: 8, position: 'relative', alignItems: 'center' }}>
                  {/* animated hand above the two photo buttons (alternates between them) */}
                  {!((user as any)?.photo || (user as any)?.fotoUrl || (user as any)?.foto) && (
                    <Animated.View style={{ position: 'absolute', top: 8, left: '50%', transform: modalHandTransform ? modalHandTransform : [], marginLeft: -12, zIndex: 50, elevation: 50 }} pointerEvents="none">
                      <Text style={{ fontSize: 26 }}>👆🏽</Text>
                    </Animated.View>
                  )}
                  <TouchableOpacity onPress={async () => {
                    const permission = await ImagePicker.requestCameraPermissionsAsync();
                    if (permission.granted) {
                      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ((ImagePicker as any).MediaType?.Images ?? (ImagePicker as any).MediaTypeOptions?.Images), allowsEditing: true, aspect: [1,1], quality: 0.6, base64: true });
                      if (!result.canceled && result.assets && result.assets[0]) {
                        const asset = result.assets[0];
                        const base64Data = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : null;
                        try {
                            if (base64Data && user?.id) {
                              const resp = await userService.update((user.id as any), { foto: base64Data });
                              const newUser = (resp?.data || resp || {});
                            let normalizedPhoto = newUser.fotoUrl || newUser.foto_url || newUser.foto || asset.uri || null;
                            try {
                              const rawApi = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000').toString().trim();
                              const host = rawApi.replace(/\/api\/v1\/?$/i, '').replace(/\/+$/, '');
                              if (typeof normalizedPhoto === 'string' && normalizedPhoto.length > 0 && !/^https?:\/\//i.test(normalizedPhoto) && !/^data:/i.test(normalizedPhoto) && !/^file:/i.test(normalizedPhoto) && !/^content:/i.test(normalizedPhoto)) {
                                const leading = normalizedPhoto.startsWith('/') ? '' : '/';
                                normalizedPhoto = `${host}${leading}${normalizedPhoto}`;
                              }
                            } catch (err) {
                              // ignore
                            }
                            updateUser({ photo: normalizedPhoto });
                              setShowModal(false);
                            } else {
                              updateUser({ photo: asset.uri });
                              setShowModal(false);
                            }
                        } catch (err) {
                          console.error('Error subiendo foto', err);
                          updateUser({ photo: asset.uri });
                        }
                      }
                    }
                  }} style={{ flex: 1, backgroundColor: '#3b82f6', padding: 10, borderRadius: 8, alignItems: 'center' }}>
                    <Text style={{ color: 'white', fontWeight: '700' }}>Tomar Foto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={async () => {
                    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (permission.granted) {
                      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ((ImagePicker as any).MediaType?.Images ?? (ImagePicker as any).MediaTypeOptions?.Images), allowsEditing: true, aspect: [1,1], quality: 0.6, base64: true });
                      if (!result.canceled && result.assets && result.assets[0]) {
                        const asset = result.assets[0];
                        const base64Data = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : null;
                        try {
                          if (base64Data && user?.id) {
                            const resp = await userService.update((user.id as any), { foto: base64Data });
                            const newUser = (resp?.data || resp || {});
                            let normalizedPhoto = newUser.fotoUrl || newUser.foto_url || newUser.foto || asset.uri || null;
                            try {
                              const rawApi = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000').toString().trim();
                              const host = rawApi.replace(/\/api\/v1\/?$/i, '').replace(/\/+$/, '');
                              if (typeof normalizedPhoto === 'string' && normalizedPhoto.length > 0 && !/^https?:\/\//i.test(normalizedPhoto) && !/^data:/i.test(normalizedPhoto) && !/^file:/i.test(normalizedPhoto) && !/^content:/i.test(normalizedPhoto)) {
                                const leading = normalizedPhoto.startsWith('/') ? '' : '/';
                                normalizedPhoto = `${host}${leading}${normalizedPhoto}`;
                              }
                            } catch (err) {
                              // ignore
                            }
                            updateUser({ photo: normalizedPhoto });
                            setShowModal(false);
                          } else {
                            updateUser({ photo: asset.uri });
                            setShowModal(false);
                          }
                        } catch (err) {
                          console.error('Error subiendo foto', err);
                          updateUser({ photo: asset.uri });
                        }
                      }
                    }
                  }} style={{ flex: 1, backgroundColor: '#10b981', padding: 10, borderRadius: 8, alignItems: 'center' }}>
                    <Text style={{ color: 'white', fontWeight: '700' }}>Subir Foto</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View>
                <Text style={{ color: muted, marginBottom: 6 }}>Tema</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity onPress={() => setTheme('dark')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: dark ? '#1E3A8A' : 'transparent', alignItems: 'center', justifyContent: 'center', borderWidth: dark ? 0 : 1, borderColor: dark ? 'transparent' : (dark ? '#374151' : '#E5E7EB') }}>
                      <Text style={{ fontSize: 18 }}>🌙</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setTheme('light')} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: !dark ? '#FDE68A' : 'transparent', alignItems: 'center', justifyContent: 'center', borderWidth: !dark ? 0 : 1, borderColor: dark ? '#374151' : '#E5E7EB' }}>
                      <Text style={{ fontSize: 18 }}>☀️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
              <TouchableOpacity onPress={() => { logout(); setShowModal(false); router.replace('/login'); }} style={{ backgroundColor: '#ef4444', padding: 12, borderRadius: 8, alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Cerrar Sesión</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => setShowModal(false)} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: muted }}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      {/* Assign mesas modal (mobile) */}
      <Modal visible={showAssignModalMobile} transparent animationType="slide" onRequestClose={() => setShowAssignModalMobile(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: bg, borderTopLeftRadius: 12, borderTopRightRadius: 12, maxHeight: '82%', padding: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: fg }}>Asignar Mesas</Text>
              <TouchableOpacity onPress={() => setShowAssignModalMobile(false)}>
                <Text style={{ fontSize: 18, color: '#ef4444', fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {modalMesas && modalMesas.length > 0 ? modalMesas.map((mesa) => {
                const selected = assignSelected.has(mesa.id);
                const assignedToMe = (mesa.usuariosAsignados || []).some((u: any) => String(u.id) === String(user?.id));
                const firstUser = (mesa.usuariosAsignados && mesa.usuariosAsignados.length > 0) ? mesa.usuariosAsignados[0] : null;
                return (
                  <TouchableOpacity key={mesa.id} onPress={() => toggleAssign(mesa.id)} style={{ width: '48%', marginBottom: 8 }}>
                    <View style={{ borderRadius: 8, padding: 8, backgroundColor: dark ? '#0f1724' : '#fff', borderWidth: 2, borderColor: selected ? PRIMARY : (dark ? '#1F2937' : '#E5E7EB'), alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: fg, marginBottom: 8 }}>{mesa.nombre || `Mesa ${mesa.numero}`}</Text>
                      {firstUser ? (
                        // support multiple possible photo fields and normalize relative paths
                        (() => {
                          const candidate = (firstUser as any).photo || (firstUser as any).fotoUrl || (firstUser as any).foto || (firstUser as any).foto_url || null;
                          const uri = normalizePhotoUri(candidate);
                          if (uri) {
                            return <Image source={{ uri }} style={{ width: 56, height: 56, borderRadius: 28, marginBottom: 8, borderWidth: 2, borderColor: assignedToMe ? PRIMARY : 'white' }} />;
                          }
                          return (
                            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                              <Text style={{ fontSize: 14, fontWeight: '700' }}>{(firstUser.nombre || 'U').charAt(0).toUpperCase()}</Text>
                            </View>
                          );
                        })()
                      ) : (
                        <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                          <Text style={{ fontSize: 14, fontWeight: '700' }}>{'N.A.'}</Text>
                        </View>
                      )}
                      <TouchableOpacity onPress={() => toggleAssign(mesa.id)} style={{ marginTop: 4, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, backgroundColor: selected ? PRIMARY : (dark ? '#111827' : '#F3F4F6') }}>
                        <Text style={{ color: selected ? 'white' : fg, fontWeight: '700' }}>{selected ? '✓ Seleccionada' : 'Seleccionar'}</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              }) : (
                <View style={{ padding: 12 }}>
                  <Text style={{ color: muted }}>No hay mesas disponibles</Text>
                </View>
              )}
            </ScrollView>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginTop: 12 }}>
              <TouchableOpacity onPress={() => setShowAssignModalMobile(false)} style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: dark ? '#374151' : '#E5E7EB', alignItems: 'center' }}>
                <Text style={{ color: fg, fontWeight: '700' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={saveAssignMobile} style={{ flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: PRIMARY, alignItems: 'center' }}>
                <Text style={{ color: 'white', fontWeight: '700' }}>Asignarme</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
