import { SafeAreaView, Text, View, FlatList, TouchableOpacity, Image, TextInput, Alert, ScrollView, Dimensions } from 'react-native';
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { localService, Local } from '../../src/services/local';
import { useThemeStore } from '../../src/store/theme';
import { onboardingService } from '../../src/services/onboarding';
import { proveedorService } from '../../src/services/proveedor';

export default function AdminDashboard() {
  const theme = useThemeStore((s) => s.theme);
  const dark = theme === 'dark';
  const bg = dark ? '#111827' : 'white';
  const fg = dark ? 'white' : '#111827';
  const muted = dark ? '#9CA3AF' : '#6B7280';

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

  const [locales, setLocales] = useState<Local[]>([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);
  
  // Estados para crear local
  const [localNombre, setLocalNombre] = useState('');
  const [localDireccion, setLocalDireccion] = useState('');
  const [localTelefono, setLocalTelefono] = useState('');
  const [nuevoLocalId, setNuevoLocalId] = useState<string | null>(null);
  
  // Estados para mesas
  const [cantidadMesas, setCantidadMesas] = useState('10');
  const [capacidadMesas, setCapacidadMesas] = useState('4');
  
  // Estados para proveedor
  const [proveedorNombre, setProveedorNombre] = useState('Propio');
  const [proveedorTelefono, setProveedorTelefono] = useState('');
  const [proveedorEmail, setProveedorEmail] = useState('');
  const [nuevoProveedorId, setNuevoProveedorId] = useState<string | null>(null);
  
  // Estados para productos
  const [productos, setProductos] = useState<Array<{nombre: string, precio: string, costo: string}>>([
    { nombre: '', precio: '', costo: '' }
  ]);

  const router = useRouter();

  useEffect(() => {
    const load = async () => {
      try {
        const data = await localService.obtenerLocales();
        const localesArray = Array.isArray(data) ? data : data?.locales || data?.data || [];
        setLocales(localesArray);
        
        // Si no hay locales, mostrar onboarding automáticamente
        if (localesArray.length === 0) {
          setShowOnboarding(true);
        }
      } catch (e) {
        console.error('Error loading locales', e);
      }
    };
    load();
  }, []);

  const handleCrearLocal = async () => {
    try {
      if (!localNombre) {
        Alert.alert('Error', 'El nombre del local es requerido');
        return;
      }
      const nuevoLocal = await localService.crear({
        nombre: localNombre,
        direccion: localDireccion,
        telefono: localTelefono
      });
      setNuevoLocalId(nuevoLocal.id);
      setOnboardingStep(2);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.message || 'Error creando local');
    }
  };

  const handleCrearMesas = async () => {
    try {
      if (!nuevoLocalId) {
        Alert.alert('Error', 'Debes crear un local primero');
        return;
      }
      const cantidad = parseInt(cantidadMesas);
      const capacidad = parseInt(capacidadMesas);
      if (isNaN(cantidad) || cantidad < 1) {
        Alert.alert('Error', 'Cantidad de mesas inválida');
        return;
      }
      await onboardingService.completarMesas(cantidad, nuevoLocalId, 'General', capacidad);
      setOnboardingStep(3);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.message || 'Error creando mesas');
    }
  };

  const handleCrearProveedor = async () => {
    try {
      if (!nuevoLocalId) {
        Alert.alert('Error', 'Debes crear un local primero');
        return;
      }
      if (!proveedorNombre) {
        Alert.alert('Error', 'El nombre del proveedor es requerido');
        return;
      }
      const nuevoProveedor = await proveedorService.crear({
        nombre: proveedorNombre,
        telefono: proveedorTelefono || null,
        email: proveedorEmail || null,
        localId: nuevoLocalId
      });
      setNuevoProveedorId(nuevoProveedor.id);
      setOnboardingStep(4);
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.message || 'Error creando proveedor');
    }
  };

  const handleCrearProductos = async () => {
    try {
      if (!nuevoLocalId || !nuevoProveedorId) {
        Alert.alert('Error', 'Faltan datos del local o proveedor');
        return;
      }
      const productosValidos = productos.filter(p => p.nombre && p.precio && p.costo);
      if (productosValidos.length === 0) {
        Alert.alert('Error', 'Debes agregar al menos un producto');
        return;
      }
      const productosParaCrear = productosValidos.map(p => ({
        nombre: p.nombre,
        precio: parseFloat(p.precio),
        costo: parseFloat(p.costo),
        proveedorId: nuevoProveedorId,
        tipo: 'comida'
      }));
      await onboardingService.crearProductosBulk(productosParaCrear, nuevoLocalId);
      await onboardingService.completar();
      
      // Recargar locales y cerrar onboarding
      const data = await localService.obtenerLocales();
      setLocales(Array.isArray(data) ? data : data?.locales || data?.data || []);
      setShowOnboarding(false);
      setOnboardingStep(1);
      Alert.alert('¡Éxito!', 'Local configurado correctamente');
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message || e?.message || 'Error creando productos');
    }
  };

  const agregarProducto = () => {
    setProductos([...productos, { nombre: '', precio: '', costo: '' }]);
  };

  const actualizarProducto = (index: number, campo: string, valor: string) => {
    const nuevosProductos = [...productos];
    nuevosProductos[index] = { ...nuevosProductos[index], [campo]: valor };
    setProductos(nuevosProductos);
  };

  const eliminarProducto = (index: number) => {
    setProductos(productos.filter((_, i) => i !== index));
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 24, paddingTop: 60, paddingBottom: footerHeight + 12, backgroundColor: bg }}>
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

      {!showOnboarding ? (
        <>
          <View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: fg }}>Admin — Locales</Text>
            <Text style={{ color: muted, marginTop: 8 }}>Locales a cargo</Text>
          </View>

          <FlatList
            data={locales}
            keyExtractor={(l) => String(l.id)}
            contentContainerStyle={{ paddingTop: 12 }}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => router.push(`/admin/local/${item.id}`)} style={{ flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: dark ? '#1F2937' : '#E5E7EB', marginBottom: 8, backgroundColor: dark ? '#0b1220' : '#FFF' }}>
                {item.logo ? (
                  <Image source={{ uri: item.logo }} style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: '#fff' }} />
                ) : null}
                {/* Small QR indicator if the local has a QR set */}
                {item.qr ? (
                  <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: '#f59e0b', alignItems: 'center', justifyContent: 'center', marginRight: 6 }}>
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>QR</Text>
                  </View>
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: fg }}>{item.nombre || `Local ${item.id}`}</Text>
                  <Text style={{ color: muted, marginTop: 2 }}>{item.direccion || ''}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={() => (
              <View style={{ paddingTop: 24 }}>
                <Text style={{ color: muted, textAlign: 'center' }}>No tienes locales todavía</Text>
              </View>
            )}
          />

          {/* Botón para agregar nuevo local */}
          <TouchableOpacity
            onPress={() => setShowOnboarding(true)}
            style={{
              position: 'absolute',
              bottom: 30,
              right: 30,
              backgroundColor: '#10b981',
              width: 60,
              height: 60,
              borderRadius: 30,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              elevation: 5
            }}
          >
            <Text style={{ color: 'white', fontSize: 30, fontWeight: '700' }}>+</Text>
          </TouchableOpacity>
        </>
      ) : (
        <ScrollView>
          <View style={{ marginBottom: 16 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: fg }}>Configuración de Local</Text>
            <Text style={{ color: muted, marginTop: 4 }}>Paso {onboardingStep} de 4</Text>
          </View>

          {onboardingStep === 1 && (
            <View style={{ gap: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: fg }}>1. Información del Local</Text>
              <View>
                <Text style={{ color: muted, marginBottom: 6 }}>Nombre del local*</Text>
                <TextInput
                  value={localNombre}
                  onChangeText={setLocalNombre}
                  placeholder="Ej: Restaurante El Sabor"
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
              </View>
              <View>
                <Text style={{ color: muted, marginBottom: 6 }}>Dirección</Text>
                <TextInput
                  value={localDireccion}
                  onChangeText={setLocalDireccion}
                  placeholder="Ej: Av. Principal 123"
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
              </View>
              <View>
                <Text style={{ color: muted, marginBottom: 6 }}>Teléfono</Text>
                <TextInput
                  value={localTelefono}
                  onChangeText={setLocalTelefono}
                  placeholder="Ej: 77123456"
                  placeholderTextColor={muted}
                  keyboardType="phone-pad"
                  style={{
                    borderWidth: 1,
                    borderColor: dark ? '#374151' : '#E5E7EB',
                    borderRadius: 8,
                    padding: 12,
                    color: fg,
                    backgroundColor: dark ? '#0b1220' : 'white'
                  }}
                />
              </View>
              <TouchableOpacity
                onPress={handleCrearLocal}
                style={{
                  backgroundColor: '#10b981',
                  padding: 14,
                  borderRadius: 8,
                  alignItems: 'center',
                  marginTop: 8
                }}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>Continuar</Text>
              </TouchableOpacity>
              {locales.length > 0 && (
                <TouchableOpacity
                  onPress={() => setShowOnboarding(false)}
                  style={{ padding: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: muted }}>Cancelar</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {onboardingStep === 2 && (
            <View style={{ gap: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: fg }}>2. Configurar Mesas</Text>
              <View>
                <Text style={{ color: muted, marginBottom: 6 }}>Cantidad de mesas*</Text>
                <TextInput
                  value={cantidadMesas}
                  onChangeText={setCantidadMesas}
                  placeholder="Ej: 10"
                  placeholderTextColor={muted}
                  keyboardType="number-pad"
                  style={{
                    borderWidth: 1,
                    borderColor: dark ? '#374151' : '#E5E7EB',
                    borderRadius: 8,
                    padding: 12,
                    color: fg,
                    backgroundColor: dark ? '#0b1220' : 'white'
                  }}
                />
              </View>
              <View>
                <Text style={{ color: muted, marginBottom: 6 }}>Capacidad por mesa</Text>
                <TextInput
                  value={capacidadMesas}
                  onChangeText={setCapacidadMesas}
                  placeholder="Ej: 4"
                  placeholderTextColor={muted}
                  keyboardType="number-pad"
                  style={{
                    borderWidth: 1,
                    borderColor: dark ? '#374151' : '#E5E7EB',
                    borderRadius: 8,
                    padding: 12,
                    color: fg,
                    backgroundColor: dark ? '#0b1220' : 'white'
                  }}
                />
              </View>
              <TouchableOpacity
                onPress={handleCrearMesas}
                style={{
                  backgroundColor: '#10b981',
                  padding: 14,
                  borderRadius: 8,
                  alignItems: 'center',
                  marginTop: 8
                }}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>Continuar</Text>
              </TouchableOpacity>
            </View>
          )}

          {onboardingStep === 3 && (
            <View style={{ gap: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: fg }}>3. Crear Proveedor</Text>
              <View>
                <Text style={{ color: muted, marginBottom: 6 }}>Nombre del proveedor*</Text>
                <TextInput
                  value={proveedorNombre}
                  onChangeText={setProveedorNombre}
                  placeholder="Ej: Propio"
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
              </View>
              <View>
                <Text style={{ color: muted, marginBottom: 6 }}>Teléfono</Text>
                <TextInput
                  value={proveedorTelefono}
                  onChangeText={setProveedorTelefono}
                  placeholder="Opcional"
                  placeholderTextColor={muted}
                  keyboardType="phone-pad"
                  style={{
                    borderWidth: 1,
                    borderColor: dark ? '#374151' : '#E5E7EB',
                    borderRadius: 8,
                    padding: 12,
                    color: fg,
                    backgroundColor: dark ? '#0b1220' : 'white'
                  }}
                />
              </View>
              <View>
                <Text style={{ color: muted, marginBottom: 6 }}>Email</Text>
                <TextInput
                  value={proveedorEmail}
                  onChangeText={setProveedorEmail}
                  placeholder="Opcional"
                  placeholderTextColor={muted}
                  keyboardType="email-address"
                  style={{
                    borderWidth: 1,
                    borderColor: dark ? '#374151' : '#E5E7EB',
                    borderRadius: 8,
                    padding: 12,
                    color: fg,
                    backgroundColor: dark ? '#0b1220' : 'white'
                  }}
                />
              </View>
              <TouchableOpacity
                onPress={handleCrearProveedor}
                style={{
                  backgroundColor: '#10b981',
                  padding: 14,
                  borderRadius: 8,
                  alignItems: 'center',
                  marginTop: 8
                }}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>Continuar</Text>
              </TouchableOpacity>
            </View>
          )}

          {onboardingStep === 4 && (
            <View style={{ gap: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: '600', color: fg }}>4. Agregar Productos</Text>
              {productos.map((producto, index) => (
                <View key={index} style={{ gap: 8, padding: 12, borderWidth: 1, borderColor: dark ? '#374151' : '#E5E7EB', borderRadius: 8, backgroundColor: dark ? '#0b1220' : 'white' }}>
                  <Text style={{ color: fg, fontWeight: '600' }}>Producto {index + 1}</Text>
                  <TextInput
                    value={producto.nombre}
                    onChangeText={(v) => actualizarProducto(index, 'nombre', v)}
                    placeholder="Nombre"
                    placeholderTextColor={muted}
                    style={{
                      borderWidth: 1,
                      borderColor: dark ? '#374151' : '#E5E7EB',
                      borderRadius: 6,
                      padding: 10,
                      color: fg,
                      backgroundColor: dark ? '#111827' : '#F9FAFB'
                    }}
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      value={producto.precio}
                      onChangeText={(v) => actualizarProducto(index, 'precio', v)}
                      placeholder="Precio"
                      placeholderTextColor={muted}
                      keyboardType="decimal-pad"
                      style={{
                        flex: 1,
                        borderWidth: 1,
                        borderColor: dark ? '#374151' : '#E5E7EB',
                        borderRadius: 6,
                        padding: 10,
                        color: fg,
                        backgroundColor: dark ? '#111827' : '#F9FAFB'
                      }}
                    />
                    <TextInput
                      value={producto.costo}
                      onChangeText={(v) => actualizarProducto(index, 'costo', v)}
                      placeholder="Costo"
                      placeholderTextColor={muted}
                      keyboardType="decimal-pad"
                      style={{
                        flex: 1,
                        borderWidth: 1,
                        borderColor: dark ? '#374151' : '#E5E7EB',
                        borderRadius: 6,
                        padding: 10,
                        color: fg,
                        backgroundColor: dark ? '#111827' : '#F9FAFB'
                      }}
                    />
                  </View>
                  {productos.length > 1 && (
                    <TouchableOpacity
                      onPress={() => eliminarProducto(index)}
                      style={{ alignSelf: 'flex-end' }}
                    >
                      <Text style={{ color: '#ef4444' }}>Eliminar</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              <TouchableOpacity
                onPress={agregarProducto}
                style={{
                  backgroundColor: dark ? '#1F2937' : '#F3F4F6',
                  padding: 12,
                  borderRadius: 8,
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: dark ? '#374151' : '#E5E7EB',
                  borderStyle: 'dashed'
                }}
              >
                <Text style={{ color: fg }}>+ Agregar otro producto</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleCrearProductos}
                style={{
                  backgroundColor: '#10b981',
                  padding: 14,
                  borderRadius: 8,
                  alignItems: 'center',
                  marginTop: 8
                }}
              >
                <Text style={{ color: 'white', fontWeight: '700' }}>Finalizar Configuración</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
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
