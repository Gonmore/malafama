import { useEffect, useMemo, useState } from 'react';
import { Alert, SafeAreaView, Text, TouchableOpacity, View, ScrollView, Animated, Image, Dimensions } from 'react-native';
import { useThemeStore } from '../../src/store/theme';
import { useRouter } from 'expo-router';
import { mesaService, Mesa } from '../../src/services/mesa';
import { useAuthStore } from '../../src/store/auth';
import { getSocket } from '../../src/services/socket';

type MesaConComanda = Mesa & {
  comandas?: any[];
  disponible?: boolean;
};

export default function MeseroDashboard() {
  const [mesas, setMesas] = useState<MesaConComanda[]>([]);
  const [verSoloAsignadas, setVerSoloAsignadas] = useState(true);
  const [tiempoActual, setTiempoActual] = useState(new Date());
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const theme = useThemeStore((s) => s.theme);
  const dark = theme === 'dark';
  const bg = dark ? '#111827' : 'white';
  const fg = dark ? 'white' : '#111827';
  const muted = dark ? '#9CA3AF' : '#6B7280';
  const isAdmin = user?.tipo === 'admin';

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

  // Actualizar tiempo cada segundo para mostrar tiempos dinámicos
  useEffect(() => {
    const intervalo = setInterval(() => {
      setTiempoActual(new Date());
    }, 1000);
    return () => clearInterval(intervalo);
  }, []);

  const load = async () => {
    try {
      let data: any = [];
      
      // Si es admin y eligió ver todas, cargar todas las mesas
      if (isAdmin && !verSoloAsignadas) {
        data = await mesaService.getAll();
      } else {
        // Cargar solo mesas asignadas
        try {
          data = await mesaService.getAssigned();
        } catch (err) {
          console.warn('[mobile][mesero] getAssigned failed ->', err);
          // Si falla y es admin, mostrar todas
          if (isAdmin) {
            data = await mesaService.getAll();
          }
        }
      }
      
      setMesas(Array.isArray(data) ? data : data?.data || data?.mesas || []);
    } catch (e: any) {
      console.error('[mobile][mesero] error loading mesas ->', e);
      const msg = e?.response?.data?.message || e?.message || 'No se pudieron cargar las mesas';
      Alert.alert('Mesas', msg);
    }
  };

  useEffect(() => {
    load();

    // Conectar al socket para actualizaciones en tiempo real
    const socket = getSocket();
    if (socket) {
      const room = user?.localId ? `atencion:${user.localId}` : 'atencion';
      socket.emit('join-room', room);

      socket.on('pedido-listo', () => {
        load();
      });

      socket.on('comanda-actualizada', () => {
        load();
      });

      socket.on('comanda-completa', () => {
        load();
      });

      return () => {
        socket.off('pedido-listo');
        socket.off('comanda-actualizada');
        socket.off('comanda-completa');
      };
    }
  }, [user?.localId, verSoloAsignadas]);

  // Separar mesas con comandas abiertas y mesas libres
  const { mesasConComandas, mesasLibres } = useMemo(() => {
    const conComandas: MesaConComanda[] = [];
    const libres: MesaConComanda[] = [];
    
    mesas.forEach(mesa => {
      const tieneComandas = mesa.comandas && mesa.comandas.length > 0;
      if (tieneComandas) {
        conComandas.push(mesa);
      } else {
        libres.push(mesa);
      }
    });
    
    return { mesasConComandas: conComandas, mesasLibres: libres };
  }, [mesas]);

  const onAbrirComanda = (mesa: MesaConComanda) => {
    console.log('[MeseroDashboard] Navegando a mesa:', mesa.id, 'numero:', mesa.numero);
    router.push(`/mesero/mesa/${mesa.id}`);
  };

  const formatTiempo = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diff = Math.floor((now.getTime() - created.getTime()) / 1000 / 60); // minutos
    return `${diff}m`;
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

  // Componente para pedido con animación de parpadeo
  const PedidoChip = ({ pedido, dark, fg }: any) => {
    const listo = pedido.estado === 'listo';
    const [fadeAnim] = useState(new Animated.Value(1));

    useEffect(() => {
      if (listo) {
        const blink = Animated.loop(
          Animated.sequence([
            Animated.timing(fadeAnim, {
              toValue: 0.3,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
          ])
        );
        blink.start();
        return () => blink.stop();
      }
    }, [listo]);

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
          opacity: listo ? fadeAnim : 1,
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

  const renderMesaConComanda = (mesa: MesaConComanda) => {
    const comandasAbiertas = (mesa.comandas || []).filter((c: any) => c.estado === 'abierta');
    
    return (
      <View
        key={mesa.id}
        style={{
          marginBottom: 12,
          borderRadius: 8,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: dark ? '#374151' : '#E5E7EB',
        }}
      >
        {/* Botón de mesa vertical a la izquierda */}
        <View style={{ flexDirection: 'row', minHeight: 100 }}>
          <TouchableOpacity
            onPress={() => onAbrirComanda(mesa)}
            style={{
              width: 60,
              backgroundColor: dark ? '#1F2937' : '#F3F4F6',
              borderRightWidth: 2,
              borderRightColor: dark ? '#4B5563' : '#D1D5DB',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 8,
            }}
          >
            <Text
              style={{
                fontSize: 14,
                fontWeight: '700',
                color: fg,
                transform: [{ rotate: '0deg' }],
                textAlign: 'center',
              }}
            >
              {mesa.nombre || `Mesa ${mesa.numero}`}
            </Text>
          </TouchableOpacity>

          {/* Comandas */}
          <View style={{ flex: 1, backgroundColor: dark ? '#1F2937' : '#F9FAFB', padding: 8 }}>
            {comandasAbiertas.map((comanda: any, idx: number) => (
              <View
                key={comanda.id}
                style={{
                  marginBottom: idx < comandasAbiertas.length - 1 ? 8 : 0,
                  flexDirection: 'row',
                  backgroundColor: dark ? '#111827' : 'white',
                  borderRadius: 6,
                  overflow: 'hidden',
                }}
              >
                {/* Botón de comanda */}
                <TouchableOpacity
                  onPress={() => onAbrirComanda(mesa)}
                  style={{
                    width: 48,
                    backgroundColor: dark ? '#111827' : '#F3F4F6',
                    borderRightWidth: 2,
                    borderRightColor: dark ? '#4B5563' : '#D1D5DB',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: fg }}>
                    C{idx + 1}
                  </Text>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#ef4444' }}>
                    {formatTiempo(comanda.createdAt || comanda.created_at)}
                  </Text>
                </TouchableOpacity>

                {/* Pedidos */}
                <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 6 }}>
                  {(comanda.pedidos || []).map((pedido: any) => (
                    <View key={pedido.id} style={{ marginRight: 8 }}>
                      <PedidoChip pedido={pedido} dark={dark} fg={fg} />
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  const renderMesaLibre = (mesa: MesaConComanda) => (
    <TouchableOpacity
      key={mesa.id}
      onPress={() => onAbrirComanda(mesa)}
      style={{
        marginBottom: 8,
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
      {/* Botón de retroceso */}
      <View style={{ position: 'absolute', top: 60, right: 20, zIndex: 10 }}>
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

      <View style={{ padding: 16, paddingTop: 60 }}>
        <Text style={{ fontSize: 20, fontWeight: '700', color: fg }}>Mesero — Mesas</Text>
        
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
                backgroundColor: verSoloAsignadas ? '#0ea5e9' : (dark ? '#374151' : '#E5E7EB'),
                borderWidth: 1,
                borderColor: verSoloAsignadas ? '#0284c7' : (dark ? '#4B5563' : '#D1D5DB'),
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
                backgroundColor: !verSoloAsignadas ? '#0ea5e9' : (dark ? '#374151' : '#E5E7EB'),
                borderWidth: 1,
                borderColor: !verSoloAsignadas ? '#0284c7' : (dark ? '#4B5563' : '#D1D5DB'),
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

      <ScrollView style={{ flex: 1, paddingHorizontal: 12, paddingTop: 16 }}>
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

        <View style={{ height: 32 }} />
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
    </SafeAreaView>
  );
}
