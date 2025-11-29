import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, ScrollView, Text, View, FlatList, Image, Alert, TouchableOpacity, TextInput, Button, Dimensions } from 'react-native';
import { localService } from '../../../src/services/local';
import { useThemeStore } from '../../../src/store/theme';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

export default function LocalDetail() {
  const router = useRouter();
  const { localId } = useLocalSearchParams<{ localId: string }>();
  // localId is a UUID string in our backend; keep it as string
  const id = localId as string;
  const [local, setLocal] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard'|'mesas'|'usuarios'|'productos'|'reportes'>('dashboard');
  const [creatingMesa, setCreatingMesa] = useState(false);
  const [newMesaNumero, setNewMesaNumero] = useState<string>('');
  const [newMesaCapacidad, setNewMesaCapacidad] = useState<string>('4');
  const [editingMesaId, setEditingMesaId] = useState<string | number | null>(null);
  const [editingMesaCapacidad, setEditingMesaCapacidad] = useState<string>('');
  // Usuarios UI state
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserTipo, setNewUserTipo] = useState<'atencion'|'cocina'|'bar'|'admin'>('atencion');
  // Editing existing user
  const [editingUserId, setEditingUserId] = useState<string | number | null>(null);
  const [editingUserName, setEditingUserName] = useState('');
  const [editingUserEmail, setEditingUserEmail] = useState('');
  const [editingUserTipo, setEditingUserTipo] = useState<'atencion'|'cocina'|'bar'|'admin'>('atencion');
  // Productos UI state
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductTipo, setNewProductTipo] = useState<'comida'|'bebida'>('comida');
  const [newProductCosto, setNewProductCosto] = useState('');
  const [newProductProveedor, setNewProductProveedor] = useState('');
  // Editing existing product
  const [editingProductId, setEditingProductId] = useState<string | number | null>(null);
  const [editingProductName, setEditingProductName] = useState('');
  const [editingProductPrice, setEditingProductPrice] = useState('');
  const [editingProductTipo, setEditingProductTipo] = useState<'comida'|'bebida'>('comida');
  const [editingProductCosto, setEditingProductCosto] = useState('');
  const [editingProductProveedor, setEditingProductProveedor] = useState('');
  const [scrapUrl, setScrapUrl] = useState('');
  const [scrapResult, setScrapResult] = useState<any | null>(null);
  const [storedReports, setStoredReports] = useState<any[] | null>(null);
  const [dashboardSummary, setDashboardSummary] = useState<any | null>(null);
  const [proveedores, setProveedores] = useState<any[]>([]);
  const [creatingProveedor, setCreatingProveedor] = useState(false);
  const [newProveedorNombre, setNewProveedorNombre] = useState('');
  const [newProveedorTelefono, setNewProveedorTelefono] = useState('');
  const [newProveedorEmail, setNewProveedorEmail] = useState('');
  // Estados para proveedores y reportes
  const [showProveedoresModal, setShowProveedoresModal] = useState(false);
  const [proveedorSelected, setProveedorSelected] = useState<any | null>(null);
  const [proveedorDetalle, setProveedorDetalle] = useState<any | null>(null);
  const [periodoProveedores, setPeriodoProveedores] = useState<'semanal'|'mensual'|'anual'>('semanal');
  const [reporteSelected, setReporteSelected] = useState<any | null>(null);
  const [showReporteModal, setShowReporteModal] = useState(false);
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth());
  const [anoSeleccionado, setAnoSeleccionado] = useState(new Date().getFullYear());
  const [semanaSeleccionada, setSemanaSeleccionada] = useState<{inicio: string, fin: string} | null>(null);
  const [semanasDelMes, setSemanasDelMes] = useState<Array<{inicio: string, fin: string, label: string}>>([]);
  const [semanasConDatos, setSemanasConDatos] = useState<Set<string>>(new Set());
  // Estados para comprobante de pago
  const [comprobanteImagen, setComprobanteImagen] = useState<string | null>(null);
  const [pagoRegistrado, setPagoRegistrado] = useState<any | null>(null);
  const [observacionesPago, setObservacionesPago] = useState('');

  const theme = useThemeStore((s) => s.theme);
  const dark = theme === 'dark';
  const bg = dark ? '#111827' : 'white';
  const fg = dark ? 'white' : '#111827';
  const muted = dark ? '#9CA3AF' : '#6B7280';
  
  // Función para calcular semanas de un mes (domingo a sábado)
  // Criterio: Una semana pertenece al mes si viernes y sábado están dentro del mes
  const calcularSemanasDelMes = (mes: number, ano: number) => {
    const primerDia = new Date(ano, mes, 1);
    const ultimoDia = new Date(ano, mes + 1, 0);
    const semanas: Array<{inicio: string, fin: string, label: string}> = [];
    
    // Empezar desde el primer día del mes e ir hacia atrás hasta encontrar el domingo
    let inicioSemana = new Date(primerDia);
    while (inicioSemana.getDay() !== 0) {
      inicioSemana.setDate(inicioSemana.getDate() - 1);
    }
    
    let numeroSemana = 1;
    while (inicioSemana <= ultimoDia) {
      const finSemana = new Date(inicioSemana);
      finSemana.setDate(finSemana.getDate() + 6); // Sábado
      
      // Calcular viernes y sábado de esta semana
      const viernes = new Date(inicioSemana);
      viernes.setDate(viernes.getDate() + 5); // Viernes (día 5 de la semana)
      const sabado = new Date(inicioSemana);
      sabado.setDate(sabado.getDate() + 6); // Sábado (día 6 de la semana)
      
      // Solo incluir si AMBOS viernes y sábado están dentro del mes
      if (viernes >= primerDia && viernes <= ultimoDia && 
          sabado >= primerDia && sabado <= ultimoDia) {
        semanas.push({
          inicio: inicioSemana.toISOString().split('T')[0],
          fin: finSemana.toISOString().split('T')[0],
          label: `Sem ${numeroSemana} [${inicioSemana.getDate()}/${mes+1} al ${finSemana.getDate()}/${mes+1}]`
        });
        numeroSemana++;
      }
      
      inicioSemana.setDate(inicioSemana.getDate() + 7);
    }
    
    return semanas;
  };

  // Calcular semanas cuando cambia el mes
  useEffect(() => {
    if (periodoProveedores === 'semanal') {
      const semanas = calcularSemanasDelMes(mesSeleccionado, anoSeleccionado);
      setSemanasDelMes(semanas);
      
      // Verificar qué semanas tienen datos
      const verificarSemanasConDatos = async () => {
        const semanasConInfo = new Set<string>();
        
        for (const semana of semanas) {
          try {
            const resp = await (await import('../../../src/services/reporte')).reporteService.getPagosSemanaProveedores(id, semana.inicio, semana.fin);
            const data = resp?.data || resp;
            // Si hay proveedores con montos, esta semana tiene datos
            if (data?.proveedores && data.proveedores.length > 0) {
              semanasConInfo.add(semana.inicio);
            }
          } catch (e) {
            // Ignorar errores, simplemente no marcar la semana
          }
        }
        
        setSemanasConDatos(semanasConInfo);
      };
      
      verificarSemanasConDatos();
      
      // Seleccionar la semana actual por defecto
      const hoy = new Date();
      if (hoy.getMonth() === mesSeleccionado && hoy.getFullYear() === anoSeleccionado) {
        const semanaActual = semanas.find(s => {
          const inicio = new Date(s.inicio);
          const fin = new Date(s.fin);
          return hoy >= inicio && hoy <= fin;
        });
        if (semanaActual) setSemanaSeleccionada(semanaActual);
        else setSemanaSeleccionada(semanas[0] || null);
      } else {
        setSemanaSeleccionada(semanas[0] || null);
      }
    }
  }, [mesSeleccionado, anoSeleccionado, periodoProveedores, id]);
  
  // Lista de proveedores para el dropdown
  const nombresProveedores = proveedores.map((p: any) => p.nombre).filter(n => n);
  const proveedoresComunes = nombresProveedores.length > 0 
    ? [...nombresProveedores, 'Otro'] 
    : ['Otro'];

  useEffect(() => {
    (async () => {
      try {
        const d = await localService.obtenerLocalPorId(id);
        // local details loaded — processed below
        setLocal(d);
        
        // Cargar proveedores
        const provs = await (await import('../../../src/services/proveedor')).proveedorService.obtenerProveedores(id);
        console.log('[DEBUG] Proveedores cargados:', provs);
        setProveedores(Array.isArray(provs) ? provs : []);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error fetching local', e);
        const msg = (e as any)?.response?.data?.message || (e as any)?.message || 'Error cargando local';
        Alert.alert('Local', msg);
      }
    })();
  }, [id]);

  const reload = async () => {
    try {
      const d = await localService.obtenerLocalPorId(id);
      setLocal(d);
      // Recargar proveedores también
      const provs = await (await import('../../../src/services/proveedor')).proveedorService.obtenerProveedores(id);
      setProveedores(Array.isArray(provs) ? provs : []);
    } catch (e) {}
  };

  const handleCreateMesa = async () => {
    try {
      if (!newMesaNumero) return Alert.alert('Mesas', 'Ingresa un número para la mesa');
      // If we have a localId (UUID), use bulk creation endpoint to ensure local association
      // backend create single mesa doesn't accept localId in some versions
        const payload = { nombre: `Mesa ${Number(newMesaNumero)}`, numero: Number(newMesaNumero), ubicacion: null, capacidad: Number(newMesaCapacidad), localId: id };
      // creating mesa using bulk endpoint as fallback for local association
        await (await import('../../../src/services/mesa')).mesaService.create(payload);
      setCreatingMesa(false);
      setNewMesaNumero('');
      setNewMesaCapacidad('4');
      await reload();
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[mobile][admin] error creating mesa ->', e);
      const msg = e?.response?.data?.message || e?.message || 'Error creando mesa';
      Alert.alert('Mesas', msg);
    }
  };

  const handleUpdateMesa = async (mesaId: string | number, updates: Record<string, any>) => {
    try {
      await (await import('../../../src/services/mesa')).mesaService.update(mesaId, updates);
      await reload();
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[mobile][admin] error updating mesa ->', e);
      const msg = e?.response?.data?.message || e?.message || 'Error actualizando mesa';
      Alert.alert('Mesas', msg);
    }
  };

  const handleDeleteMesa = async (mesaId: string | number) => {
    try {
      await (await import('../../../src/services/mesa')).mesaService.remove(mesaId);
      await reload();
      Alert.alert('Mesas', 'Mesa eliminada');
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Error eliminando mesa';
      Alert.alert('Mesas', msg);
    }
  };

  const handleCreateUser = async () => {
    try {
      if (!newUserEmail || !newUserName) return Alert.alert('Usuarios', 'Completa nombre y email');
      const payload = { nombre: newUserName, email: newUserEmail, tipo: newUserTipo, localId: id };
      // creating new user payload processed below
      const resp = await (await import('../../../src/services/user')).userService.create(payload);
      // If created, refresh
      setCreatingUser(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserTipo('atencion');
      await reload();
      Alert.alert('Usuarios', resp?.message || 'Usuario creado');
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[mobile][admin] error creating user ->', e);
      const msg = e?.response?.data?.message || e?.message || 'Error creando usuario';
      Alert.alert('Usuarios', msg);
    }
  };

  const handleResetUser = async (userId: string | number) => {
    try {
      const resp = await (await import('../../../src/services/user')).userService.resetPassword(userId);
      const pwd = resp?.data?.passwordPorDefecto || resp?.data?.passwordPorDefecto || resp?.data?.password || 'password123';
      Alert.alert('Usuarios', `Contraseña reseteada: ${pwd}`);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[mobile][admin] error reset password ->', e);
      const msg = e?.response?.data?.message || e?.message || 'Error reseteando contraseña';
      Alert.alert('Usuarios', msg);
    }
  };

  const handleCreateProduct = async () => {
    try {
      if (!newProductName) return Alert.alert('Productos', 'Nombre requerido');
      
      // Si el proveedor es "Otro" y hay un nombre personalizado, crear el proveedor primero
      let proveedorId = null;
      if (newProductProveedor && newProductProveedor !== 'Otro') {
        // Buscar el proveedor por nombre
        const prov = proveedores.find((p: any) => p.nombre === newProductProveedor);
        proveedorId = prov?.id || null;
      }
      
      const payload: any = { 
        nombre: newProductName, 
        precio: newProductPrice ? Number(newProductPrice) : undefined,
        tipo: newProductTipo,
        costo: newProductCosto ? Number(newProductCosto) : undefined,
        proveedorId,
        localId: id 
      };
      const resp = await (await import('../../../src/services/producto')).productoService.create(payload);
      setCreatingProduct(false);
      setNewProductName('');
      setNewProductPrice('');
      setNewProductTipo('comida');
      setNewProductCosto('');
      setNewProductProveedor('');
      await reload();
      Alert.alert('Productos', resp?.message || 'Producto creado');
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[mobile][admin] error creating product ->', e);
      const msg = e?.response?.data?.message || e?.message || 'Error creando producto';
      Alert.alert('Productos', msg);
    }
  };

  const handleDeleteProduct = async (productId: string | number) => {
    try {
      await (await import('../../../src/services/producto')).productoService.remove(productId);
      await reload();
      Alert.alert('Productos', 'Producto eliminado');
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Error eliminando producto';
      Alert.alert('Productos', msg);
    }
  };

  const handleCreateProveedor = async () => {
    try {
      if (!newProveedorNombre) return Alert.alert('Proveedores', 'Nombre requerido');
      const payload = {
        nombre: newProveedorNombre,
        telefono: newProveedorTelefono || null,
        email: newProveedorEmail || null,
        localId: id
      };
      const nuevoProveedor = await (await import('../../../src/services/proveedor')).proveedorService.crear(payload);
      setCreatingProveedor(false);
      setNewProveedorNombre('');
      setNewProveedorTelefono('');
      setNewProveedorEmail('');
      await reload();
      // Seleccionar automáticamente el nuevo proveedor
      if (creatingProduct) {
        setNewProductProveedor(nuevoProveedor.nombre);
      } else if (editingProductId) {
        setEditingProductProveedor(nuevoProveedor.nombre);
      }
      Alert.alert('Proveedores', 'Proveedor creado exitosamente');
    } catch (e: any) {
      console.error('[mobile][admin] error creating proveedor ->', e);
      const msg = e?.response?.data?.message || e?.message || 'Error creando proveedor';
      Alert.alert('Proveedores', msg);
    }
  };

  const handleScrapMenu = async () => {
    try {
      if (!scrapUrl) return Alert.alert('Scraping', 'Ingresa una URL');
      const resp = await (await import('../../../src/services/scraping')).scrapingService.scrapearMenu(scrapUrl);
      setScrapResult(resp?.data || null);

      // Compare scraped product names with current local products
      const scrapedNames = (resp?.data?.productos || []).map((p: any) => (p.nombre || '').toLowerCase());
      const localNames = (local?.productos || []).map((p: any) => (p.nombre || '').toLowerCase());
      const nuevos = scrapedNames.filter((n: string) => n && !localNames.includes(n));
      const faltantes = localNames.filter((n: string) => n && !scrapedNames.includes(n));

      Alert.alert('Scraping', `${resp?.message || 'Resultado'}\nEncontrados: ${scrapedNames.length}\nNuevos: ${nuevos.length}\nFaltantes: ${faltantes.length}`);
    } catch (e: any) {
      // eslint-disable-next-line no-console
      console.error('[mobile][admin] scrap error ->', e);
      const msg = e?.response?.data?.message || e?.message || 'Error realizando scraping';
      Alert.alert('Scraping', msg);
    }
  };

  // Load mobile-local footer logos — copied to `mobile/assets/SNT_logo` for reliable bundling
  let lightFooterLogo: any = null;
  let darkFooterLogo: any = null;
  try {
    lightFooterLogo = require('../../../assets/SNT_logo/Logo_Azul.png');
    darkFooterLogo = require('../../../assets/SNT_logo/Logo_Blanco.png');
  } catch (err) {
    // ignore — fallback to text
  }

  // use device dimensions to size footer responsively
  const window = Dimensions.get('window');
  const footerHeight = Math.max(56, Math.round(window.height * 0.072));

  return (
    <SafeAreaView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 40, backgroundColor: bg, paddingBottom: footerHeight + 16 }}>
      {/* Botón de regreso en esquina superior derecha */}
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

      <View style={{ marginBottom: 12, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        {local?.logo ? (
          <Image source={{ uri: local.logo }} style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: '#fff' }} />
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: fg }}>{local?.nombre || `Local ${localId}`}</Text>
          <Text style={{ color: muted, marginTop: 6 }}>{local?.descripcion || ''}</Text>
        </View>
      </View>

      {/* Menú de navegación con emojis - siempre visible */}
      <View style={{ marginBottom: 16 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          {[
            { key: 'mesas', label: 'Mesas', emoji: '🪑' },
            { key: 'usuarios', label: 'Usuarios', emoji: '👥' },
            { key: 'productos', label: 'Productos', emoji: '🛍️' },
            { key: 'reportes', label: 'Reportes', emoji: '📊' },
          ].map((t: any) => (
            <TouchableOpacity 
              key={t.key} 
              onPress={() => setActiveTab(t.key as any)} 
              style={{ 
                flex: 1, 
                marginHorizontal: 2, 
                padding: 12, 
                borderRadius: 10, 
                backgroundColor: activeTab === t.key ? (dark ? '#1e40af' : '#3b82f6') : (dark ? '#0b1220' : '#F3F4F6'), 
                borderWidth: 1, 
                borderColor: activeTab === t.key ? (dark ? '#2563eb' : '#60a5fa') : (dark ? '#1F2937' : '#E5E7EB'), 
                alignItems: 'center' 
              }}
            >
              <Text style={{ fontSize: 18 }}>{t.emoji}</Text>
              <Text style={{ marginTop: 6, fontWeight: activeTab === t.key ? '700' : '600', fontSize: 11, color: activeTab === t.key ? '#ffffff' : fg }}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={{ marginBottom: 8 }}>

        {activeTab === 'mesas' && (
          <View>
            <View style={{ marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: '700', color: fg }}>Mesas</Text>
              <TouchableOpacity onPress={() => setCreatingMesa(true)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: dark ? '#1F2937' : '#E5E7EB' }}>
                <Text style={{ color: fg }}>➕ Agregar mesa</Text>
              </TouchableOpacity>
            </View>
            {creatingMesa ? (
              <View style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: dark ? '#1F2937' : '#E5E7EB', backgroundColor: dark ? '#0b1220' : 'white', marginBottom: 8 }}>
                <Text style={{ color: muted }}>Número</Text>
                <TextInput value={newMesaNumero} onChangeText={setNewMesaNumero} keyboardType="numeric" style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 8, marginTop: 8, borderRadius: 6, color: fg }} />
                <Text style={{ color: muted, marginTop: 8 }}>Capacidad</Text>
                <TextInput value={newMesaCapacidad} onChangeText={setNewMesaCapacidad} keyboardType="numeric" style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 8, marginTop: 8, borderRadius: 6, color: fg }} />
                <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Button title="Cancelar" onPress={() => setCreatingMesa(false)} color="#6B7280" />
                  <Button title="Crear" onPress={handleCreateMesa} color="#0ea5e9" />
                </View>
              </View>
            ) : null}
            <FlatList
            data={local?.mesas || []}
          contentContainerStyle={{ paddingTop: 8 }}
          keyExtractor={(m: any) => String(m.id)}
          numColumns={2}
          columnWrapperStyle={{ justifyContent: 'space-between' }}
            renderItem={({ item }: { item: any }) => (
              <View style={{ width: '48%', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: dark ? '#1F2937' : '#E5E7EB', marginBottom: 8, backgroundColor: dark ? '#0b1220' : 'white' }}>
                <Text style={{ fontWeight: '700', color: fg }}>{item.nombre}</Text>
                <Text style={{ color: muted, fontSize: 12 }}>{item.numero} · Cap: {item.capacidad ?? '—'}</Text>
                {editingMesaId === item.id ? (
                  <View style={{ marginTop: 8 }}>
                    <TextInput value={editingMesaCapacidad} onChangeText={setEditingMesaCapacidad} keyboardType="numeric" placeholder="Capacidad" style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 6, borderRadius: 6, color: fg, fontSize: 12 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                      <TouchableOpacity onPress={() => { setEditingMesaId(null); setEditingMesaCapacidad(''); }}>
                        <Text style={{ color: '#6B7280', fontSize: 11 }}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => {
                        const cap = Number(editingMesaCapacidad || item.capacidad || 0);
                        handleUpdateMesa(item.id, { capacidad: cap });
                        setEditingMesaId(null);
                        setEditingMesaCapacidad('');
                      }}>
                        <Text style={{ color: '#0ea5e9', fontSize: 11 }}>Guardar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                    <TouchableOpacity onPress={() => { setEditingMesaId(item.id); setEditingMesaCapacidad(String(item.capacidad ?? 4)); }}>
                      <Text style={{ color: '#0ea5e9' }}>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteMesa(item.id)}>
                      <Text style={{ color: '#ef4444' }}>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          ListEmptyComponent={() => <Text style={{ color: muted, marginTop: 8 }}>No hay mesas para este local</Text>}
            />
          </View>
        )}
      </View>

        {activeTab === 'usuarios' && (
          <View style={{ marginTop: 8 }}>
            <View style={{ marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: '700', color: fg }}>Usuarios</Text>
              <TouchableOpacity onPress={() => setCreatingUser(true)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: dark ? '#1F2937' : '#E5E7EB' }}>
                <Text style={{ color: fg }}>➕ Agregar usuario</Text>
              </TouchableOpacity>
            </View>

            {creatingUser && (
              <View style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: dark ? '#1F2937' : '#E5E7EB', backgroundColor: dark ? '#0b1220' : 'white', marginBottom: 8 }}>
                <Text style={{ color: muted }}>Nombre</Text>
                <TextInput value={newUserName} onChangeText={setNewUserName} style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 8, marginTop: 8, borderRadius: 6, color: fg }} />
                <Text style={{ color: muted, marginTop: 8 }}>Email</Text>
                <TextInput value={newUserEmail} onChangeText={setNewUserEmail} keyboardType="email-address" autoCapitalize="none" style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 8, marginTop: 8, borderRadius: 6, color: fg }} />
                <Text style={{ color: muted, marginTop: 8 }}>Tipo</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {['atencion', 'cocina', 'bar', 'admin'].map((tipo) => (
                    <TouchableOpacity key={tipo} onPress={() => setNewUserTipo(tipo as any)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: newUserTipo === tipo ? '#0ea5e9' : '#E5E7EB', backgroundColor: newUserTipo === tipo ? '#0ea5e91a' : 'transparent' }}>
                      <Text style={{ color: newUserTipo === tipo ? '#0ea5e9' : muted, fontSize: 13 }}>{tipo}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Button title="Cancelar" onPress={() => setCreatingUser(false)} color="#6B7280" />
                  <Button title="Crear" onPress={handleCreateUser} color="#0ea5e9" />
                </View>
              </View>
            )}

            <FlatList
              data={local?.empleados || []}
              contentContainerStyle={{ paddingTop: 8 }}
              keyExtractor={(m: any) => String(m.id)}
              renderItem={({ item }: { item: any }) => (
                <View style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: dark ? '#1F2937' : '#E5E7EB', marginBottom: 8, backgroundColor: dark ? '#0b1220' : 'white' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: fg }}>{item.nombre}</Text>
                      <Text style={{ color: muted }}>{item.email} · {item.tipo}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity onPress={() => handleResetUser(item.id)}>
                        <Text style={{ color: '#f59e0b' }}>👁️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => { 
                        if (editingUserId === item.id) {
                          setEditingUserId(null);
                          setEditingUserName('');
                          setEditingUserEmail('');
                          setEditingUserTipo('atencion');
                        } else {
                          setEditingUserId(item.id);
                          setEditingUserName(item.nombre || '');
                          setEditingUserEmail(item.email || '');
                          setEditingUserTipo(item.tipo || 'atencion');
                        }
                      }}>
                        <Text style={{ color: '#0ea5e9' }}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={async () => {
                        try {
                          await (await import('../../../src/services/user')).userService.remove(item.id);
                          await reload();
                          Alert.alert('Usuarios', 'Usuario eliminado');
                        } catch (e: any) {
                          const msg = e?.response?.data?.message || e?.message || 'Error eliminando usuario';
                          Alert.alert('Usuarios', msg);
                        }
                      }}>
                        <Text style={{ color: '#ef4444' }}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  {editingUserId === item.id && (
                    <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: dark ? '#1F2937' : '#E5E7EB' }}>
                      <Text style={{ color: muted, fontSize: 12, marginBottom: 6 }}>Nombre</Text>
                      <TextInput value={editingUserName} onChangeText={setEditingUserName} placeholder="Nombre" style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 8, borderRadius: 6, color: fg, marginBottom: 8 }} />
                      <Text style={{ color: muted, fontSize: 12, marginBottom: 6 }}>Email</Text>
                      <TextInput value={editingUserEmail} onChangeText={setEditingUserEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 8, borderRadius: 6, color: fg, marginBottom: 8 }} />
                      <Text style={{ color: muted, fontSize: 12, marginBottom: 6 }}>Tipo</Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        {['atencion', 'cocina', 'bar', 'admin'].map((tipo) => (
                          <TouchableOpacity key={tipo} onPress={() => setEditingUserTipo(tipo as any)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, borderWidth: 1, borderColor: editingUserTipo === tipo ? '#0ea5e9' : '#E5E7EB', backgroundColor: editingUserTipo === tipo ? '#0ea5e91a' : 'transparent' }}>
                            <Text style={{ color: editingUserTipo === tipo ? '#0ea5e9' : muted, fontSize: 12 }}>{tipo}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                        <TouchableOpacity onPress={() => { setEditingUserId(null); setEditingUserName(''); setEditingUserEmail(''); setEditingUserTipo('atencion'); }}>
                          <Text style={{ color: '#6B7280' }}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={async () => {
                          try {
                            const payload = { nombre: editingUserName || item.nombre, email: editingUserEmail || item.email, tipo: editingUserTipo || item.tipo };
                            const resp = await (await import('../../../src/services/user')).userService.update(item.id, payload);
                            setEditingUserId(null);
                            setEditingUserName('');
                            setEditingUserEmail('');
                            setEditingUserTipo('atencion');
                            await reload();
                            Alert.alert('Usuarios', resp?.message || 'Usuario actualizado');
                          } catch (e: any) {
                            const msg = e?.response?.data?.message || e?.message || 'Error actualizando usuario';
                            Alert.alert('Usuarios', msg);
                          }
                        }}>
                          <Text style={{ color: '#0ea5e9' }}>Guardar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              )}
              ListEmptyComponent={() => <Text style={{ color: muted, marginTop: 8 }}>No hay empleados</Text>}
            />
          </View>
        )}

        {activeTab === 'productos' && (
          <View style={{ marginTop: 8 }}>
            <View style={{ marginBottom: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontWeight: '700', color: fg }}>Productos</Text>
              <TouchableOpacity onPress={() => setCreatingProduct(true)} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: dark ? '#1F2937' : '#E5E7EB' }}>
                <Text style={{ color: fg }}>➕ Agregar producto</Text>
              </TouchableOpacity>
            </View>

            {creatingProduct && (
              <View style={{ padding: 10, borderRadius: 8, borderWidth: 1, borderColor: dark ? '#1F2937' : '#E5E7EB', backgroundColor: dark ? '#0b1220' : 'white', marginBottom: 8 }}>
                <Text style={{ color: muted }}>Nombre</Text>
                <TextInput value={newProductName} onChangeText={setNewProductName} style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 8, marginTop: 8, borderRadius: 6, color: fg }} />
                <Text style={{ color: muted, marginTop: 8 }}>Precio (venta)</Text>
                <TextInput value={newProductPrice} onChangeText={setNewProductPrice} keyboardType="numeric" style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 8, marginTop: 8, borderRadius: 6, color: fg }} />
                <Text style={{ color: muted, marginTop: 8 }}>Tipo</Text>
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                  <TouchableOpacity onPress={() => setNewProductTipo('comida')} style={{ flex: 1, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: newProductTipo === 'comida' ? '#0ea5e9' : '#E5E7EB', backgroundColor: newProductTipo === 'comida' ? '#0ea5e91a' : 'transparent' }}>
                    <Text style={{ color: newProductTipo === 'comida' ? '#0ea5e9' : muted, textAlign: 'center' }}>🍽️ Comida</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setNewProductTipo('bebida')} style={{ flex: 1, padding: 10, borderRadius: 6, borderWidth: 1, borderColor: newProductTipo === 'bebida' ? '#0ea5e9' : '#E5E7EB', backgroundColor: newProductTipo === 'bebida' ? '#0ea5e91a' : 'transparent' }}>
                    <Text style={{ color: newProductTipo === 'bebida' ? '#0ea5e9' : muted, textAlign: 'center' }}>🥤 Bebida</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ color: muted, marginTop: 8 }}>Costo</Text>
                <TextInput value={newProductCosto} onChangeText={setNewProductCosto} keyboardType="numeric" placeholder="Costo del producto" style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 8, marginTop: 8, borderRadius: 6, color: fg }} />
                <Text style={{ color: muted, marginTop: 8 }}>Proveedor</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {proveedoresComunes.map((prov) => (
                    <TouchableOpacity key={prov} onPress={() => {
                      if (prov === 'Otro') {
                        setCreatingProveedor(true);
                      } else {
                        setNewProductProveedor(prov);
                      }
                    }} style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: newProductProveedor === prov ? '#0ea5e9' : '#E5E7EB', backgroundColor: newProductProveedor === prov ? '#0ea5e91a' : 'transparent' }}>
                      <Text style={{ color: newProductProveedor === prov ? '#0ea5e9' : muted, fontSize: 12 }}>{prov === 'Otro' ? '+ Nuevo' : prov}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={{ marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Button title="Cancelar" onPress={() => setCreatingProduct(false)} color="#6B7280" />
                  <Button title="Crear" onPress={handleCreateProduct} color="#0ea5e9" />
                </View>
              </View>
            )}

            <FlatList
              data={local?.productos || []}
              contentContainerStyle={{ paddingTop: 8 }}
              keyExtractor={(m: any) => String(m.id)}
              numColumns={2}
              columnWrapperStyle={{ justifyContent: 'space-between' }}
              renderItem={({ item }: { item: any }) => (
                <View style={{ width: '48%', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: dark ? '#1F2937' : '#E5E7EB', marginBottom: 8, backgroundColor: dark ? '#0b1220' : 'white' }}>
                  <Text style={{ fontWeight: '700', color: fg, fontSize: 14 }}>{item.tipo === 'bebida' ? '🥤' : '🍽️'} {item.nombre}</Text>
                  <Text style={{ color: muted, fontSize: 12 }}>{item.precio ? `Bs ${Number(item.precio).toFixed(2)}` : ''}</Text>
                  {item.proveedor && <Text style={{ color: muted, fontSize: 11 }}>📦 {item.proveedor}</Text>}
                  {editingProductId === item.id ? (
                    <View style={{ marginTop: 8 }}>
                      <TextInput value={editingProductName} onChangeText={setEditingProductName} placeholder="Nombre" style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 6, borderRadius: 6, color: fg, fontSize: 12, marginBottom: 6 }} />
                      <TextInput value={editingProductPrice} onChangeText={setEditingProductPrice} placeholder="Precio" keyboardType="numeric" style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 6, borderRadius: 6, color: fg, fontSize: 12, marginBottom: 6 }} />
                      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
                        <TouchableOpacity onPress={() => setEditingProductTipo('comida')} style={{ flex: 1, padding: 6, borderRadius: 4, borderWidth: 1, borderColor: editingProductTipo === 'comida' ? '#0ea5e9' : '#E5E7EB', backgroundColor: editingProductTipo === 'comida' ? '#0ea5e91a' : 'transparent' }}>
                          <Text style={{ color: editingProductTipo === 'comida' ? '#0ea5e9' : muted, textAlign: 'center', fontSize: 10 }}>🍽️</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setEditingProductTipo('bebida')} style={{ flex: 1, padding: 6, borderRadius: 4, borderWidth: 1, borderColor: editingProductTipo === 'bebida' ? '#0ea5e9' : '#E5E7EB', backgroundColor: editingProductTipo === 'bebida' ? '#0ea5e91a' : 'transparent' }}>
                          <Text style={{ color: editingProductTipo === 'bebida' ? '#0ea5e9' : muted, textAlign: 'center', fontSize: 10 }}>🥤</Text>
                        </TouchableOpacity>
                      </View>
                      <TextInput value={editingProductCosto} onChangeText={setEditingProductCosto} placeholder="Costo" keyboardType="numeric" style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 6, borderRadius: 6, color: fg, fontSize: 12, marginBottom: 6 }} />
                      <View style={{ flexDirection: 'row', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
                        {proveedoresComunes.map((prov) => (
                          <TouchableOpacity key={prov} onPress={() => {
                            if (prov === 'Otro') {
                              setCreatingProveedor(true);
                            } else {
                              setEditingProductProveedor(prov);
                            }
                          }} style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, borderWidth: 1, borderColor: editingProductProveedor === prov ? '#0ea5e9' : '#E5E7EB', backgroundColor: editingProductProveedor === prov ? '#0ea5e91a' : 'transparent' }}>
                            <Text style={{ color: editingProductProveedor === prov ? '#0ea5e9' : muted, fontSize: 10 }}>{prov === 'Otro' ? '+ Nuevo' : prov}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <TouchableOpacity onPress={() => { setEditingProductId(null); setEditingProductName(''); setEditingProductPrice(''); setEditingProductTipo('comida'); setEditingProductCosto(''); setEditingProductProveedor(''); }}>
                          <Text style={{ color: '#6B7280', fontSize: 11 }}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={async () => {
                          try {
                            const payload: any = { nombre: editingProductName || item.nombre, tipo: editingProductTipo };
                            if (editingProductPrice !== '') payload.precio = Number(editingProductPrice);
                            if (editingProductCosto !== '') payload.costo = Number(editingProductCosto);
                            if (editingProductProveedor !== '') payload.proveedor = editingProductProveedor;
                            const resp = await (await import('../../../src/services/producto')).productoService.update(item.id, payload);
                            setEditingProductId(null);
                            setEditingProductName('');
                            setEditingProductPrice('');
                            setEditingProductTipo('comida');
                            setEditingProductCosto('');
                            setEditingProductProveedor('');
                            await reload();
                            Alert.alert('Productos', resp?.message || 'Producto actualizado');
                          } catch (e: any) {
                            const msg = e?.response?.data?.message || e?.message || 'Error actualizando producto';
                            Alert.alert('Productos', msg);
                          }
                        }}>
                          <Text style={{ color: '#0ea5e9', fontSize: 11 }}>Guardar</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                      <TouchableOpacity onPress={() => { 
                        setEditingProductId(item.id);
                        setEditingProductName(item.nombre || '');
                        setEditingProductPrice(item.precio ? String(item.precio) : '');
                        setEditingProductTipo(item.tipo || 'comida');
                        setEditingProductCosto(item.costo ? String(item.costo) : '');
                        setEditingProductProveedor(item.proveedor || '');
                      }}>
                        <Text style={{ color: '#0ea5e9' }}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteProduct(item.id)}>
                        <Text style={{ color: '#ef4444' }}>🗑️</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
              ListEmptyComponent={() => <Text style={{ color: muted, marginTop: 8 }}>No hay productos</Text>}
            />

            <View style={{ marginTop: 16 }}>
              <Text style={{ fontWeight: '700', color: fg }}>Scrapping de menú</Text>
              <Text style={{ color: muted, marginTop: 4 }}>Ingresa la URL del menú y presiona "Scrapear" para comparar resultados</Text>
              <TextInput placeholder="https://sitio.com/menu" value={scrapUrl} onChangeText={setScrapUrl} style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 8, marginTop: 8, borderRadius: 6, color: fg }} />
              <View style={{ marginTop: 8, flexDirection: 'row', gap: 8 }}>
                <Button title="Preview & Comparar" onPress={handleScrapMenu} color="#0ea5e9" />
              </View>
              {scrapResult ? (
                <View style={{ marginTop: 8 }}>
                  <Text style={{ color: muted }}>Resultado: {scrapResult.total || '0'} productos</Text>
                </View>
              ) : null}
            </View>
          </View>
        )}

      {activeTab === 'reportes' && (
        <ScrollView style={{ marginTop: 8 }} showsVerticalScrollIndicator={false}>
          <Text style={{ fontWeight: '700', color: fg, marginBottom: 12, fontSize: 18 }}>📊 Reportes y Análisis</Text>
          
          {/* Dashboard resumen con KPIs */}
          {dashboardSummary && (
            <View style={{ marginBottom: 16, padding: 16, borderWidth: 1, borderColor: dark ? '#1F2937' : '#E5E7EB', borderRadius: 12, backgroundColor: dark ? '#1a1f2e' : '#ffffff', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 }}>
              <Text style={{ fontWeight: '700', color: fg, marginBottom: 12, fontSize: 16 }}>📈 Resumen General</Text>
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: dark ? '#374151' : '#E5E7EB' }}>
                  <Text style={{ color: muted }}>Total Pedidos</Text>
                  <Text style={{ fontWeight: '700', color: fg, fontSize: 16 }}>{dashboardSummary?.totalPedidos || 0}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: dark ? '#374151' : '#E5E7EB' }}>
                  <Text style={{ color: muted }}>Ingresos Totales</Text>
                  <Text style={{ fontWeight: '700', color: '#10b981', fontSize: 16 }}>Bs {Number(dashboardSummary?.totalIngresos || 0).toFixed(2)}</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: muted }}>Ticket Promedio</Text>
                  <Text style={{ fontWeight: '600', color: fg, fontSize: 14 }}>Bs {dashboardSummary?.totalPedidos > 0 ? (Number(dashboardSummary?.totalIngresos || 0) / dashboardSummary.totalPedidos).toFixed(2) : '0.00'}</Text>
                </View>
                {dashboardSummary?.productosTop && dashboardSummary.productosTop.length > 0 && (
                  <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: dark ? '#374151' : '#E5E7EB' }}>
                    <Text style={{ color: muted, fontSize: 13, fontWeight: '600', marginBottom: 6 }}>🏆 Top Productos</Text>
                    {dashboardSummary.productosTop.slice(0, 5).map((p: any, i: number) => (
                      <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: fg, fontSize: 12 }}>{i + 1}. {p.nombre}</Text>
                        <Text style={{ color: muted, fontSize: 12 }}>{p.cantidad} unidades</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Botones de acción principales */}
          <View style={{ gap: 12, marginBottom: 16 }}>
            <TouchableOpacity onPress={async () => {
              try {
                const resp = await (await import('../../../src/services/reporte')).reporteService.getDashboard(id);
                const data = resp?.data || resp;
                setDashboardSummary(data);
              } catch (e: any) {
                const msg = e?.response?.data?.message || e?.message || 'Error obteniendo resumen';
                Alert.alert('Error', msg);
              }
            }} style={{ padding: 14, borderWidth: 1, borderColor: '#0ea5e9', borderRadius: 10, backgroundColor: dark ? '#0b1832' : '#eff6ff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#0ea5e9', fontWeight: '700', fontSize: 15 }}>📊 Dashboard General</Text>
                <Text style={{ color: muted, fontSize: 12, marginTop: 3 }}>Ver resumen de ventas y productos</Text>
              </View>
              <Text style={{ color: '#0ea5e9', fontSize: 18 }}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={async () => {
              try {
                const resp = await (await import('../../../src/services/reporte')).reporteService.getReportePeriodo(id, 'mensual');
                const data = resp?.data || resp;
                if (!data?.resumen) {
                  Alert.alert('Reportes', 'No hay datos disponibles para este período');
                  return;
                }
                const resumen = data.resumen;
                const mensaje = `📅 Período: Último mes\n\n💰 Total Ventas: Bs ${resumen.totalVentas}\n📋 Comandas: ${resumen.totalComandas}\n🎫 Ticket Promedio: Bs ${resumen.ticketPromedio}\n📊 Margen: ${resumen.margenPorcentaje}%`;
                Alert.alert('Reporte Mensual', mensaje);
              } catch (e: any) {
                const msg = e?.response?.data?.message || e?.message || 'Error obteniendo reporte';
                Alert.alert('Error', msg);
              }
            }} style={{ padding: 14, borderWidth: 1, borderColor: '#10b981', borderRadius: 10, backgroundColor: dark ? '#0b1f1a' : '#f0fdf4', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#10b981', fontWeight: '700', fontSize: 15 }}>📅 Reporte Mensual</Text>
                <Text style={{ color: muted, fontSize: 12, marginTop: 3 }}>Análisis completo del último mes</Text>
              </View>
              <Text style={{ color: '#10b981', fontSize: 18 }}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={async () => {
              try {
                const resp = await (await import('../../../src/services/reporte')).reporteService.getProductosMasVendidos({ localId: id, limit: 10 });
                const data = resp?.data || resp;
                const productos = data?.productos || data || [];
                if (productos.length === 0) {
                  Alert.alert('Productos', 'No hay datos de productos vendidos');
                } else {
                  const mensaje = productos.slice(0, 5).map((p: any, i: number) => 
                    `${i + 1}. ${p.nombre}: ${p.cantidad || p.totalVendido || p.total_vendido} unidades`
                  ).join('\n');
                  Alert.alert('Top 5 Productos Más Vendidos', mensaje);
                }
              } catch (e: any) {
                const msg = e?.response?.data?.message || e?.message || 'Error obteniendo productos';
                Alert.alert('Error', msg);
              }
            }} style={{ padding: 14, borderWidth: 1, borderColor: '#8b5cf6', borderRadius: 10, backgroundColor: dark ? '#1a1432' : '#faf5ff', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#8b5cf6', fontWeight: '700', fontSize: 15 }}>🍽️ Productos Más Vendidos</Text>
                <Text style={{ color: muted, fontSize: 12, marginTop: 3 }}>Ranking de productos por ventas</Text>
              </View>
              <Text style={{ color: '#8b5cf6', fontSize: 18 }}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={async () => {
              try {
                const resp = await (await import('../../../src/services/reporte')).reporteService.getReporteDiarioStored(id);
                const reports = resp?.reportes || resp?.data || resp || [];
                setStoredReports(Array.isArray(reports) ? reports : []);
                Alert.alert('Reportes Almacenados', `Se encontraron ${Array.isArray(reports) ? reports.length : 0} reportes guardados`);
              } catch (e: any) {
                const msg = e?.response?.data?.message || e?.message || 'Error obteniendo reportes';
                Alert.alert('Error', msg);
              }
            }} style={{ padding: 14, borderWidth: 1, borderColor: '#f59e0b', borderRadius: 10, backgroundColor: dark ? '#1f1a0b' : '#fffbeb', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#f59e0b', fontWeight: '700', fontSize: 15 }}>📁 Reportes Almacenados</Text>
                <Text style={{ color: muted, fontSize: 12, marginTop: 3 }}>Historial de reportes generados</Text>
              </View>
              <Text style={{ color: '#f59e0b', fontSize: 18 }}>→</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setShowProveedoresModal(true)} style={{ padding: 14, borderWidth: 1, borderColor: '#ef4444', borderRadius: 10, backgroundColor: dark ? '#1f0b0b' : '#fef2f2', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 15 }}>💰 Pagos a Proveedores</Text>
                <Text style={{ color: muted, fontSize: 12, marginTop: 3 }}>Detalles por proveedor y período</Text>
              </View>
              <Text style={{ color: '#ef4444', fontSize: 18 }}>→</Text>
            </TouchableOpacity>
          </View>

          {/* Lista de reportes almacenados */}
          {storedReports && storedReports.length > 0 && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ fontWeight: '700', color: fg, marginBottom: 10, fontSize: 16 }}>📋 Reportes Guardados ({storedReports.length})</Text>
              {storedReports.map((item: any, index: number) => (
                <TouchableOpacity 
                  key={index} 
                  onPress={() => {
                    setReporteSelected(item);
                    setShowReporteModal(true);
                  }}
                  style={{ padding: 14, borderWidth: 1, borderColor: dark ? '#1F2937' : '#E5E7EB', borderRadius: 10, marginBottom: 10, backgroundColor: dark ? '#1a1f2e' : '#ffffff' }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '700', color: fg, fontSize: 15 }}>📄 {item.tipo || 'Reporte'} - {item.fecha ? new Date(item.fecha).toLocaleDateString('es-BO') : 'Sin fecha'}</Text>
                      <Text style={{ color: muted, fontSize: 11, marginTop: 2 }}>ID: {item.id || '—'}</Text>
                    </View>
                    <Text style={{ color: '#0ea5e9', fontSize: 16 }}>👁️</Text>
                  </View>
                  <View style={{ gap: 4 }}>
                    {item.totalPedidos !== undefined && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: muted, fontSize: 12 }}>Pedidos:</Text>
                        <Text style={{ color: fg, fontSize: 12, fontWeight: '600' }}>{item.totalPedidos}</Text>
                      </View>
                    )}
                    {item.totalIngresos !== undefined && (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: muted, fontSize: 12 }}>Ingresos:</Text>
                        <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '600' }}>Bs {Number(item.totalIngresos).toFixed(2)}</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: dark ? '#374151' : '#E5E7EB' }}>
                    <Text style={{ color: '#0ea5e9', fontSize: 11, textAlign: 'center' }}>Toca para ver detalles completos</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {/* Modal para crear proveedor */}
      {creatingProveedor && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ backgroundColor: bg, borderRadius: 12, padding: 20, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: dark ? '#1F2937' : '#E5E7EB' }}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: fg, marginBottom: 16 }}>Nuevo Proveedor</Text>
            
            <Text style={{ color: muted, marginBottom: 6 }}>Nombre *</Text>
            <TextInput 
              value={newProveedorNombre} 
              onChangeText={setNewProveedorNombre} 
              placeholder="Nombre del proveedor"
              style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 10, borderRadius: 6, color: fg, marginBottom: 12 }} 
            />
            
            <Text style={{ color: muted, marginBottom: 6 }}>Teléfono</Text>
            <TextInput 
              value={newProveedorTelefono} 
              onChangeText={setNewProveedorTelefono} 
              placeholder="Teléfono de contacto"
              keyboardType="phone-pad"
              style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 10, borderRadius: 6, color: fg, marginBottom: 12 }} 
            />
            
            <Text style={{ color: muted, marginBottom: 6 }}>Email</Text>
            <TextInput 
              value={newProveedorEmail} 
              onChangeText={setNewProveedorEmail} 
              placeholder="Email del proveedor"
              keyboardType="email-address"
              autoCapitalize="none"
              style={{ borderWidth: 1, borderColor: '#E5E7EB', padding: 10, borderRadius: 6, color: fg, marginBottom: 16 }} 
            />
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity 
                onPress={() => {
                  setCreatingProveedor(false);
                  setNewProveedorNombre('');
                  setNewProveedorTelefono('');
                  setNewProveedorEmail('');
                }}
                style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: dark ? '#1F2937' : '#E5E7EB', alignItems: 'center' }}
              >
                <Text style={{ color: fg }}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={handleCreateProveedor}
                style={{ flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#0ea5e9', alignItems: 'center' }}
              >
                <Text style={{ color: 'white', fontWeight: '600' }}>Crear Proveedor</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Modal de Pagos a Proveedores */}
      {showProveedoresModal && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <ScrollView 
            style={{ flex: 1, paddingHorizontal: 16, paddingTop: 20 }} 
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={true}
          >
            <View style={{ backgroundColor: bg, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: dark ? '#1F2937' : '#E5E7EB', marginBottom: 20, width: '100%', maxWidth: 600, alignSelf: 'center' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: fg }}>💰 Pagos a Proveedores</Text>
                <TouchableOpacity onPress={() => { 
                  setShowProveedoresModal(false); 
                  setProveedorSelected(null); 
                  setProveedorDetalle(null);
                  setSemanaSeleccionada(null);
                }}>
                  <Text style={{ color: '#ef4444', fontSize: 20 }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Selector de período */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ color: muted, marginBottom: 8, fontSize: 13 }}>Período</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {['semanal', 'mensual', 'anual'].map((p: any) => (
                    <TouchableOpacity 
                      key={p}
                      onPress={() => {
                        setPeriodoProveedores(p);
                        setProveedorDetalle(null);
                        setProveedorSelected(null);
                        setSemanaSeleccionada(null);
                      }}
                      style={{ 
                        flex: 1, 
                        padding: 10, 
                        borderRadius: 8, 
                        backgroundColor: periodoProveedores === p ? '#0ea5e9' : (dark ? '#1F2937' : '#F3F4F6'),
                        borderWidth: 1,
                        borderColor: periodoProveedores === p ? '#0284c7' : (dark ? '#374151' : '#E5E7EB'),
                        alignItems: 'center'
                      }}
                    >
                      <Text style={{ color: periodoProveedores === p ? 'white' : fg, fontWeight: periodoProveedores === p ? '600' : '400', fontSize: 11 }}>
                        {p === 'semanal' ? '📅 Semanal' : p === 'mensual' ? '📆 Mensual' : '📊 Anual'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Selector de mes/año */}
              <View style={{ marginBottom: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: muted, marginBottom: 6, fontSize: 12 }}>Mes</Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <TouchableOpacity 
                        onPress={() => {
                          const nuevoMes = mesSeleccionado === 0 ? 11 : mesSeleccionado - 1;
                          const nuevoAno = mesSeleccionado === 0 ? anoSeleccionado - 1 : anoSeleccionado;
                          setMesSeleccionado(nuevoMes);
                          setAnoSeleccionado(nuevoAno);
                          setProveedorDetalle(null);
                          setSemanaSeleccionada(null);
                        }}
                        style={{ padding: 8, backgroundColor: dark ? '#1F2937' : '#E5E7EB', borderRadius: 6 }}
                      >
                        <Text style={{ color: fg }}>◀</Text>
                      </TouchableOpacity>
                      <View style={{ flex: 1, padding: 8, backgroundColor: dark ? '#0b1220' : '#F3F4F6', borderRadius: 6, alignItems: 'center' }}>
                        <Text style={{ color: fg, fontWeight: '600' }}>
                          {new Date(anoSeleccionado, mesSeleccionado).toLocaleDateString('es-BO', { month: 'long' })}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        onPress={() => {
                          const nuevoMes = mesSeleccionado === 11 ? 0 : mesSeleccionado + 1;
                          const nuevoAno = mesSeleccionado === 11 ? anoSeleccionado + 1 : anoSeleccionado;
                          setMesSeleccionado(nuevoMes);
                          setAnoSeleccionado(nuevoAno);
                          setProveedorDetalle(null);
                          setSemanaSeleccionada(null);
                        }}
                        style={{ padding: 8, backgroundColor: dark ? '#1F2937' : '#E5E7EB', borderRadius: 6 }}
                      >
                        <Text style={{ color: fg }}>▶</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: muted, marginBottom: 6, fontSize: 12 }}>Año</Text>
                    <View style={{ flexDirection: 'row', gap: 4 }}>
                      <TouchableOpacity 
                        onPress={() => {
                          setAnoSeleccionado(anoSeleccionado - 1);
                          setProveedorDetalle(null);
                          setSemanaSeleccionada(null);
                        }}
                        style={{ padding: 8, backgroundColor: dark ? '#1F2937' : '#E5E7EB', borderRadius: 6 }}
                      >
                        <Text style={{ color: fg }}>◀</Text>
                      </TouchableOpacity>
                      <View style={{ flex: 1, padding: 8, backgroundColor: dark ? '#0b1220' : '#F3F4F6', borderRadius: 6, alignItems: 'center' }}>
                        <Text style={{ color: fg, fontWeight: '600' }}>{anoSeleccionado}</Text>
                      </View>
                      <TouchableOpacity 
                        onPress={() => {
                          setAnoSeleccionado(anoSeleccionado + 1);
                          setProveedorDetalle(null);
                          setSemanaSeleccionada(null);
                        }}
                        style={{ padding: 8, backgroundColor: dark ? '#1F2937' : '#E5E7EB', borderRadius: 6 }}
                      >
                        <Text style={{ color: fg }}>▶</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>

              {/* Selector de semana (solo para período semanal) */}
              {periodoProveedores === 'semanal' && semanasDelMes.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ color: muted, marginBottom: 8, fontSize: 13 }}>Selecciona la semana</Text>
                  <View style={{ gap: 6 }}>
                    {semanasDelMes.map((sem, idx) => {
                      const tieneDatos = semanasConDatos.has(sem.inicio);
                      return (
                        <TouchableOpacity
                          key={idx}
                          onPress={() => {
                            setSemanaSeleccionada(sem);
                            setProveedorDetalle(null);
                            setProveedorSelected(null);
                          }}
                          style={{
                            padding: 12,
                            borderRadius: 8,
                            backgroundColor: semanaSeleccionada?.inicio === sem.inicio ? '#dbeafe' : (dark ? '#1a1f2e' : '#f9fafb'),
                            borderWidth: 1,
                            borderColor: semanaSeleccionada?.inicio === sem.inicio ? '#3b82f6' : (dark ? '#374151' : '#E5E7EB')
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={{ color: semanaSeleccionada?.inicio === sem.inicio ? '#1e40af' : fg, fontWeight: semanaSeleccionada?.inicio === sem.inicio ? '600' : '400', fontSize: 13, flex: 1 }}>
                              {sem.label}
                            </Text>
                            {tieneDatos && (
                              <View style={{ marginLeft: 8, backgroundColor: '#10b981', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                                <Text style={{ color: 'white', fontSize: 10, fontWeight: '600' }}>📊 Datos</Text>
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Botón para cargar datos */}
              <TouchableOpacity 
                onPress={async () => {
                  try {
                    let startDate, endDate;
                    
                    if (periodoProveedores === 'semanal') {
                      if (!semanaSeleccionada) {
                        Alert.alert('Error', 'Selecciona una semana');
                        return;
                      }
                      startDate = semanaSeleccionada.inicio;
                      endDate = semanaSeleccionada.fin;
                    } else if (periodoProveedores === 'mensual') {
                      const inicioMes = new Date(anoSeleccionado, mesSeleccionado, 1);
                      const finMes = new Date(anoSeleccionado, mesSeleccionado + 1, 0);
                      startDate = inicioMes.toISOString().split('T')[0];
                      endDate = finMes.toISOString().split('T')[0];
                    } else {
                      const inicioAno = new Date(anoSeleccionado, 0, 1);
                      const finAno = new Date(anoSeleccionado, 11, 31);
                      startDate = inicioAno.toISOString().split('T')[0];
                      endDate = finAno.toISOString().split('T')[0];
                    }
                    
                    const resp = await (await import('../../../src/services/reporte')).reporteService.getPagosSemanaProveedores(id, startDate, endDate);
                    const data = resp?.data || resp;
                    setProveedorDetalle(data);
                  } catch (e: any) {
                    Alert.alert('Error', e?.response?.data?.message || e?.message || 'Error cargando datos');
                  }
                }}
                style={{ padding: 12, borderRadius: 8, backgroundColor: '#10b981', alignItems: 'center', marginBottom: 16 }}
              >
                <Text style={{ color: 'white', fontWeight: '600' }}>🔄 Cargar Datos</Text>
              </TouchableOpacity>

              {/* Lista de proveedores */}
              {proveedorDetalle?.proveedores && proveedorDetalle.proveedores.length > 0 ? (
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, padding: 12, backgroundColor: dark ? '#1a1f2e' : '#f0fdf4', borderRadius: 8, borderWidth: 1, borderColor: dark ? '#374151' : '#10b981' }}>
                    <Text style={{ fontWeight: '600', color: fg }}>Total a pagar:</Text>
                    <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: '700' }}>Bs {proveedorDetalle.resumen?.total || '0.00'}</Text>
                  </View>
                  {proveedorDetalle.proveedores.map((prov: any, idx: number) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={async () => {
                        setProveedorSelected(prov);
                        try {
                          let startDate, endDate;
                          if (periodoProveedores === 'semanal') {
                            startDate = semanaSeleccionada?.inicio;
                            endDate = semanaSeleccionada?.fin;
                          } else if (periodoProveedores === 'mensual') {
                            const inicioMes = new Date(anoSeleccionado, mesSeleccionado, 1);
                            const finMes = new Date(anoSeleccionado, mesSeleccionado + 1, 0);
                            startDate = inicioMes.toISOString().split('T')[0];
                            endDate = finMes.toISOString().split('T')[0];
                          } else {
                            const inicioAno = new Date(anoSeleccionado, 0, 1);
                            const finAno = new Date(anoSeleccionado, 11, 31);
                            startDate = inicioAno.toISOString().split('T')[0];
                            endDate = finAno.toISOString().split('T')[0];
                          }
                          const detalle = await (await import('../../../src/services/reporte')).reporteService.getDetalleProveedor(prov.proveedor_id, id, startDate, endDate);
                          setProveedorDetalle({ ...proveedorDetalle, detalleSeleccionado: detalle?.data || detalle });
                          
                          // Verificar si ya existe un pago registrado para este período
                          try {
                            const pagoVerificacion = await (await import('../../../src/services/reporte')).reporteService.verificarPagoProveedor(
                              prov.proveedor_id,
                              id,
                              startDate!,
                              endDate!
                            );
                            if (pagoVerificacion.pagado) {
                              setPagoRegistrado(pagoVerificacion.pago);
                            } else {
                              setPagoRegistrado(null);
                            }
                          } catch (err) {
                            console.error('Error verificando pago:', err);
                            setPagoRegistrado(null);
                          }
                        } catch (e: any) {
                          Alert.alert('Error', e?.message || 'Error cargando detalle');
                        }
                      }}
                      style={{ 
                        padding: 12, 
                        marginBottom: 10, 
                        borderRadius: 8, 
                        backgroundColor: proveedorSelected?.proveedor_id === prov.proveedor_id ? '#fef3c7' : (dark ? '#1a1f2e' : '#ffffff'),
                        borderWidth: 1,
                        borderColor: proveedorSelected?.proveedor_id === prov.proveedor_id ? '#f59e0b' : (dark ? '#374151' : '#E5E7EB')
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ fontWeight: '700', color: fg, flex: 1 }}>{prov.proveedor || prov.nombre}</Text>
                        <Text style={{ fontWeight: '700', color: '#ef4444' }}>Bs {Number(prov.monto_adeudado || 0).toFixed(2)}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
                        <Text style={{ color: muted, fontSize: 11 }}>📦 {prov.unidades_vendidas} unidades</Text>
                        <Text style={{ color: muted, fontSize: 11 }}>🧾 {prov.comandas} comandas</Text>
                        {prov.telefono && <Text style={{ color: muted, fontSize: 11 }}>📞 {prov.telefono}</Text>}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : proveedorDetalle ? (
                <Text style={{ color: muted, textAlign: 'center', padding: 20 }}>No hay datos para este período</Text>
              ) : null}

              {/* Detalle de productos del proveedor seleccionado */}
              {proveedorDetalle?.detalleSeleccionado?.productos && (
                <View style={{ marginTop: 16, padding: 12, borderRadius: 8, backgroundColor: dark ? '#0b1220' : '#f9fafb', borderWidth: 1, borderColor: dark ? '#374151' : '#E5E7EB' }}>
                  <Text style={{ fontWeight: '700', color: fg, marginBottom: 12, fontSize: 15 }}>
                    📋 Productos de {proveedorSelected?.proveedor || proveedorSelected?.nombre}
                  </Text>
                  <Text style={{ color: muted, fontSize: 12, marginBottom: 12 }}>
                    Período: {proveedorDetalle.detalleSeleccionado.resumen?.periodo?.inicio} al {proveedorDetalle.detalleSeleccionado.resumen?.periodo?.fin}
                  </Text>
                  {proveedorDetalle.detalleSeleccionado.productos.map((prod: any, i: number) => (
                    <View key={i} style={{ marginBottom: 8, paddingBottom: 8, borderBottomWidth: i < proveedorDetalle.detalleSeleccionado.productos.length - 1 ? 1 : 0, borderBottomColor: dark ? '#374151' : '#E5E7EB' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: fg, fontWeight: '600', flex: 1 }}>{prod.producto}</Text>
                        <Text style={{ color: '#ef4444', fontWeight: '600' }}>Bs {Number(prod.monto_adeudado || 0).toFixed(2)}</Text>
                      </View>
                      <Text style={{ color: muted, fontSize: 11, marginTop: 2 }}>
                        {prod.unidades_vendidas} unidades en {prod.comandas} comandas
                      </Text>
                    </View>
                  ))}
                  <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 2, borderTopColor: dark ? '#374151' : '#E5E7EB' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontWeight: '700', color: fg }}>Total:</Text>
                      <Text style={{ fontWeight: '700', color: '#ef4444', fontSize: 16 }}>Bs {proveedorDetalle.detalleSeleccionado.resumen?.total || '0.00'}</Text>
                    </View>
                  </View>

                  {/* Botón para enviar comprobante de pago */}
                  <View style={{ marginTop: 16, padding: 16, borderRadius: 8, backgroundColor: dark ? '#1a1f2e' : '#f0fdf4', borderWidth: 1, borderColor: dark ? '#374151' : '#10b981' }}>
                    <Text style={{ fontWeight: '700', color: fg, marginBottom: 12, fontSize: 14 }}>💳 Comprobante de Pago</Text>
                    
                    {/* Verificar si ya fue pagado */}
                    {pagoRegistrado ? (
                      <View style={{ gap: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, backgroundColor: '#dcfce7', borderRadius: 8, borderWidth: 1, borderColor: '#10b981' }}>
                          <Text style={{ fontSize: 24 }}>✅</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: '#166534', fontWeight: '600' }}>Pago Registrado</Text>
                            <Text style={{ color: '#15803d', fontSize: 11 }}>
                              {new Date(pagoRegistrado.fecha_pago).toLocaleString('es-BO')}
                            </Text>
                          </View>
                        </View>
                        {pagoRegistrado.comprobante_url && (
                          <Image 
                            source={{ uri: pagoRegistrado.comprobante_url }} 
                            style={{ width: '100%', height: 200, borderRadius: 8, marginTop: 8 }}
                            resizeMode="contain"
                          />
                        )}
                        {pagoRegistrado.observaciones && (
                          <Text style={{ color: muted, fontSize: 12, fontStyle: 'italic' }}>
                            Nota: {pagoRegistrado.observaciones}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <View style={{ gap: 12 }}>
                        {/* Botones para capturar/seleccionar imagen */}
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity
                            onPress={async () => {
                              const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
                              if (!permissionResult.granted) {
                                Alert.alert('Permiso requerido', 'Necesitas dar permiso para usar la cámara');
                                return;
                              }
                              const result = await ImagePicker.launchCameraAsync({
                                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                                allowsEditing: true,
                                quality: 0.7,
                                base64: true
                              });
                              if (!result.canceled && result.assets[0]) {
                                setComprobanteImagen(`data:image/jpeg;base64,${result.assets[0].base64}`);
                              }
                            }}
                            style={{ flex: 1, padding: 12, backgroundColor: '#3b82f6', borderRadius: 8, alignItems: 'center' }}
                          >
                            <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>📷 Tomar Foto</Text>
                          </TouchableOpacity>
                          
                          <TouchableOpacity
                            onPress={async () => {
                              const result = await ImagePicker.launchImageLibraryAsync({
                                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                                allowsEditing: true,
                                quality: 0.7,
                                base64: true
                              });
                              if (!result.canceled && result.assets[0]) {
                                setComprobanteImagen(`data:image/jpeg;base64,${result.assets[0].base64}`);
                              }
                            }}
                            style={{ flex: 1, padding: 12, backgroundColor: '#8b5cf6', borderRadius: 8, alignItems: 'center' }}
                          >
                            <Text style={{ color: 'white', fontWeight: '600', fontSize: 13 }}>🖼️ Galería</Text>
                          </TouchableOpacity>
                        </View>

                        {/* Mostrar imagen seleccionada */}
                        {comprobanteImagen && (
                          <View>
                            <Image 
                              source={{ uri: comprobanteImagen }} 
                              style={{ width: '100%', height: 200, borderRadius: 8, marginBottom: 8 }}
                              resizeMode="contain"
                            />
                            <TouchableOpacity
                              onPress={() => setComprobanteImagen(null)}
                              style={{ padding: 8, backgroundColor: '#ef4444', borderRadius: 6, alignItems: 'center' }}
                            >
                              <Text style={{ color: 'white', fontSize: 12 }}>✕ Quitar imagen</Text>
                            </TouchableOpacity>
                          </View>
                        )}

                        {/* Campo de observaciones */}
                        <View>
                          <Text style={{ color: muted, fontSize: 12, marginBottom: 4 }}>Observaciones (opcional)</Text>
                          <TextInput
                            value={observacionesPago}
                            onChangeText={setObservacionesPago}
                            placeholder="Agregar nota sobre el pago..."
                            placeholderTextColor={muted}
                            multiline
                            numberOfLines={2}
                            style={{
                              borderWidth: 1,
                              borderColor: dark ? '#374151' : '#E5E7EB',
                              borderRadius: 6,
                              padding: 10,
                              color: fg,
                              backgroundColor: dark ? '#0b1220' : 'white',
                              fontSize: 13
                            }}
                          />
                        </View>

                        {/* Botón para registrar pago */}
                        <TouchableOpacity
                          onPress={async () => {
                            if (!comprobanteImagen) {
                              Alert.alert('Error', 'Debes adjuntar un comprobante');
                              return;
                            }
                            
                            try {
                              let startDate, endDate;
                              if (periodoProveedores === 'semanal') {
                                startDate = semanaSeleccionada?.inicio;
                                endDate = semanaSeleccionada?.fin;
                              } else if (periodoProveedores === 'mensual') {
                                const inicioMes = new Date(anoSeleccionado, mesSeleccionado, 1);
                                const finMes = new Date(anoSeleccionado, mesSeleccionado + 1, 0);
                                startDate = inicioMes.toISOString().split('T')[0];
                                endDate = finMes.toISOString().split('T')[0];
                              } else {
                                const inicioAno = new Date(anoSeleccionado, 0, 1);
                                const finAno = new Date(anoSeleccionado, 11, 31);
                                startDate = inicioAno.toISOString().split('T')[0];
                                endDate = finAno.toISOString().split('T')[0];
                              }

                              const resp = await (await import('../../../src/services/reporte')).reporteService.registrarPagoProveedor({
                                proveedorId: proveedorSelected.proveedor_id,
                                localId: id,
                                fechaInicio: startDate!,
                                fechaFin: endDate!,
                                montoPagado: Number(proveedorDetalle.detalleSeleccionado.resumen?.total || 0),
                                comprobanteUrl: comprobanteImagen,
                                detalle: proveedorDetalle.detalleSeleccionado,
                                observaciones: observacionesPago
                              });

                              Alert.alert('✅ Éxito', 'Pago registrado correctamente');
                              setPagoRegistrado({
                                fecha_pago: new Date().toISOString(),
                                comprobante_url: comprobanteImagen,
                                observaciones: observacionesPago
                              });
                              setComprobanteImagen(null);
                              setObservacionesPago('');
                            } catch (e: any) {
                              Alert.alert('Error', e?.response?.data?.error || e?.message || 'Error registrando pago');
                            }
                          }}
                          style={{ padding: 14, backgroundColor: '#10b981', borderRadius: 8, alignItems: 'center' }}
                        >
                          <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>✅ Registrar Pago</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Modal de Detalle de Reporte */}
      {showReporteModal && reporteSelected && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <ScrollView style={{ width: '100%', maxWidth: 500 }} showsVerticalScrollIndicator={false}>
            <View style={{ backgroundColor: bg, borderRadius: 12, padding: 20, borderWidth: 1, borderColor: dark ? '#1F2937' : '#E5E7EB' }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: '700', color: fg }}>📄 Detalle del Reporte</Text>
                <TouchableOpacity onPress={() => { setShowReporteModal(false); setReporteSelected(null); }}>
                  <Text style={{ color: '#ef4444', fontSize: 20 }}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={{ gap: 12 }}>
                <View style={{ padding: 12, backgroundColor: dark ? '#0b1220' : '#f9fafb', borderRadius: 8 }}>
                  <Text style={{ color: muted, fontSize: 11 }}>Fecha</Text>
                  <Text style={{ color: fg, fontWeight: '600', fontSize: 14 }}>
                    {reporteSelected.fecha ? new Date(reporteSelected.fecha).toLocaleDateString('es-BO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'Sin fecha'}
                  </Text>
                </View>

                <View style={{ padding: 12, backgroundColor: dark ? '#0b1220' : '#f9fafb', borderRadius: 8 }}>
                  <Text style={{ color: muted, fontSize: 11 }}>ID del Reporte</Text>
                  <Text style={{ color: fg, fontWeight: '600', fontSize: 14 }}>{reporteSelected.id || '—'}</Text>
                </View>

                {reporteSelected.tipo && (
                  <View style={{ padding: 12, backgroundColor: dark ? '#0b1220' : '#f9fafb', borderRadius: 8 }}>
                    <Text style={{ color: muted, fontSize: 11 }}>Tipo</Text>
                    <Text style={{ color: fg, fontWeight: '600', fontSize: 14 }}>{reporteSelected.tipo}</Text>
                  </View>
                )}

                <View style={{ padding: 12, backgroundColor: dark ? '#1a1f2e' : '#ffffff', borderRadius: 8, borderWidth: 1, borderColor: dark ? '#374151' : '#E5E7EB' }}>
                  <Text style={{ color: fg, fontWeight: '700', marginBottom: 8 }}>📊 Métricas</Text>
                  {reporteSelected.totalPedidos !== undefined && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: muted }}>Total de Pedidos:</Text>
                      <Text style={{ color: fg, fontWeight: '600' }}>{reporteSelected.totalPedidos}</Text>
                    </View>
                  )}
                  {reporteSelected.totalIngresos !== undefined && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: muted }}>Ingresos:</Text>
                      <Text style={{ color: '#10b981', fontWeight: '700' }}>Bs {Number(reporteSelected.totalIngresos).toFixed(2)}</Text>
                    </View>
                  )}
                  {reporteSelected.totalComandas !== undefined && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={{ color: muted }}>Comandas:</Text>
                      <Text style={{ color: fg, fontWeight: '600' }}>{reporteSelected.totalComandas}</Text>
                    </View>
                  )}
                  {reporteSelected.ticketPromedio !== undefined && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: muted }}>Ticket Promedio:</Text>
                      <Text style={{ color: fg, fontWeight: '600' }}>Bs {Number(reporteSelected.ticketPromedio).toFixed(2)}</Text>
                    </View>
                  )}
                </View>

                {reporteSelected.productos && reporteSelected.productos.length > 0 && (
                  <View style={{ padding: 12, backgroundColor: dark ? '#0b1220' : '#f9fafb', borderRadius: 8 }}>
                    <Text style={{ color: fg, fontWeight: '700', marginBottom: 8 }}>🏆 Productos Top</Text>
                    {reporteSelected.productos.slice(0, 10).map((p: any, i: number) => (
                      <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text style={{ color: fg, fontSize: 12 }}>{i + 1}. {p.nombre}</Text>
                        <Text style={{ color: muted, fontSize: 12 }}>{p.cantidad} uds</Text>
                      </View>
                    ))}
                  </View>
                )}

                {reporteSelected.observaciones && (
                  <View style={{ padding: 12, backgroundColor: dark ? '#0b1220' : '#f9fafb', borderRadius: 8 }}>
                    <Text style={{ color: muted, fontSize: 11 }}>Observaciones</Text>
                    <Text style={{ color: fg, fontSize: 13, marginTop: 4 }}>{reporteSelected.observaciones}</Text>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      )}

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
