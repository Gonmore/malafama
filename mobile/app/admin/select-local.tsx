import { Text, View, FlatList, TouchableOpacity, Image, TextInput, Alert, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEffect, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { localService, Local } from '../../src/services/local';
import { useThemeStore } from '../../src/store/theme';
import { useAuthStore } from '../../src/store/auth';
import { onboardingService } from '../../src/services/onboarding';
import { proveedorService } from '../../src/services/proveedor';
import { showErrorAlert } from '../../src/utils/errorHandler';
import api from '../../src/services/api';
import TopNav from '../components/TopNav';

export default function SelectLocal() {
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
  const [localLogo, setLocalLogo] = useState<string | null>(null);
  const [nuevoLocalId, setNuevoLocalId] = useState<string | null>(null);
  
  // Estados para usuarios generados (para mostrar en resumen)
  const [usuariosGenerados, setUsuariosGenerados] = useState<Array<{localId: string, usuarios: any[], localNombre: string}>>([]);
  
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

  // Estados para tabs (Crear local vs Crear cadena)
  const [creationType, setCreationType] = useState<'local' | 'cadena'>('local');
  
  // Estados para cadena de locales
  const [cadenaNombre, setCadenaNombre] = useState('');
  const [cadenaLogo, setCadenaLogo] = useState<string | null>(null);
  const [cantidadLocales, setCantidadLocales] = useState('2');
  const [direccionesLocales, setDireccionesLocales] = useState<string[]>(['', '']);
  const [localesCreados, setLocalesCreados] = useState<string[]>([]); // IDs de locales creados en cadena

  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const load = async () => {
      try {
        console.log('🔄 Cargando locales...');
        // Pequeña espera para asegurar que el API está inicializado
        await new Promise(resolve => setTimeout(() => resolve(null), 100));
        
        const data = await localService.obtenerLocales();
        console.log('📦 Datos recibidos de obtenerLocales:', data);
        
        const localesArray = Array.isArray(data) ? data : data?.locales || data?.data || [];
        console.log('📍 Locales procesados:', localesArray);
        
        setLocales(localesArray);
        
        // Si no hay locales, mostrar onboarding automáticamente
        if (localesArray.length === 0) {
          console.log('⚠️ No hay locales, mostrando onboarding');
          setShowOnboarding(true);
        } else {
          console.log('✅ Se encontraron', localesArray.length, 'locales');
        }
      } catch (e) {
        console.error('❌ Error cargando locales:', e);
        showErrorAlert(e, {
          onRetry: load
        });
      }
    };
    load();
  }, []);

  const handleSelectLocal = async (local: Local) => {
    try {
      await AsyncStorage.setItem('selectedLocalId', local.id.toString());
      router.replace('/home');
    } catch (e) {
      console.error('Error setting selected local', e);
      Alert.alert('Error', 'No se pudo seleccionar el local');
    }
  };

  const handleCrearLocal = async () => {
    try {
      if (!localNombre) {
        Alert.alert('Error', 'El nombre del local es requerido');
        return;
      }
      const payload: any = {
        nombre: localNombre,
        direccion: localDireccion,
        telefono: localTelefono
      };
      if (localLogo) payload.logo = localLogo;

      const response = await api.post('/locales', payload);
      const usuarios = response.data?.data?.usuarios || [];
      
      setNuevoLocalId(response.data?.data?.local?.id?.toString());
      setUsuariosGenerados([{
        localId: response.data?.data?.local?.id?.toString() || '',
        usuarios: usuarios,
        localNombre: localNombre
      }]);
      setOnboardingStep(2);
    } catch (e: any) {
      showErrorAlert(e, {
        onRetry: handleCrearLocal
      });
    }
  };

  const pickLogoFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a la galería para seleccionar el logo');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ((ImagePicker as any).MediaType?.Images ?? (ImagePicker as any).MediaTypeOptions?.Images), allowsEditing: true, aspect: [1,1], quality: 0.7, base64: true });
    if (!res.canceled && res.assets && res.assets[0]) {
      const asset = res.assets[0];
      const base64Data = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : null;
      if (base64Data) {
        if (creationType === 'local') {
          setLocalLogo(base64Data);
        } else {
          setCadenaLogo(base64Data);
        }
      }
    }
  };

  const takeLogoWithCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a la cámara para tomar el logo');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ((ImagePicker as any).MediaType?.Images ?? (ImagePicker as any).MediaTypeOptions?.Images), allowsEditing: true, aspect: [1,1], quality: 0.7, base64: true });
    if (!res.canceled && res.assets && res.assets[0]) {
      const asset = res.assets[0];
      const base64Data = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : null;
      if (base64Data) {
        if (creationType === 'local') {
          setLocalLogo(base64Data);
        } else {
          setCadenaLogo(base64Data);
        }
      }
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
      
      // Si es cadena, crear mesas en todos los locales
      const localesParaMesas = creationType === 'cadena' && localesCreados.length > 0 
        ? localesCreados 
        : [nuevoLocalId];

      for (const localId of localesParaMesas) {
        await onboardingService.completarMesas(cantidad, localId, 'General', capacidad);
      }

      setOnboardingStep(3);
    } catch (e: any) {
      showErrorAlert(e, {
        onRetry: handleCrearMesas
      });
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

      // Si es cadena, crear proveedor en todos los locales
      const localesParaProveedor = creationType === 'cadena' && localesCreados.length > 0 
        ? localesCreados 
        : [nuevoLocalId];

      let primerProveedorId: string | null = null;

      for (const localId of localesParaProveedor) {
        const nuevoProveedor = await proveedorService.crear({
          nombre: proveedorNombre,
          telefono: proveedorTelefono || null,
          email: proveedorEmail || null,
          localId: localId
        });
        if (!primerProveedorId) {
          primerProveedorId = nuevoProveedor.id.toString();
        }
      }

      setNuevoProveedorId(primerProveedorId);
      setOnboardingStep(4);
    } catch (e: any) {
      showErrorAlert(e, {
        onRetry: handleCrearProveedor
      });
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

      // Si es cadena, crear productos en todos los locales
      const localesParaProductos = creationType === 'cadena' && localesCreados.length > 0 
        ? localesCreados 
        : [nuevoLocalId];

      for (const localId of localesParaProductos) {
        // Obtener proveedores de este local específico
        const proveedoresLocal = await proveedorService.obtenerProveedores(localId);
        const proveedorLocal = proveedoresLocal.find((p: any) => p.nombre === proveedorNombre);
        
        if (proveedorLocal) {
          const productosParaCrear = productosValidos.map(p => ({
            nombre: p.nombre,
            precio: parseFloat(p.precio),
            costo: parseFloat(p.costo),
            proveedorId: proveedorLocal.id,
            tipo: 'comida'
          }));
          await onboardingService.crearProductosBulk(productosParaCrear, localId);
        }
      }

      await onboardingService.completar();
      
      // Mostrar resumen si es cadena
      if (creationType === 'cadena' && localesCreados.length > 1) {
        setOnboardingStep(5); // Ir a resumen
      } else {
        // Recargar locales y cerrar onboarding
        const data = await localService.obtenerLocales();
        setLocales(Array.isArray(data) ? data : data?.locales || data?.data || []);
        setShowOnboarding(false);
        resetearOnboarding();
        Alert.alert('¡Éxito!', 'Local configurado correctamente');
      }
    } catch (e: any) {
      showErrorAlert(e, {
        onRetry: handleCrearProductos
      });
    }
  };

  const resetearOnboarding = () => {
    setLocalNombre('');
    setLocalDireccion('');
    setLocalTelefono('');
    setLocalLogo(null);
    setNuevoLocalId(null);
    setUsuariosGenerados([]);
    setCadenaNombre('');
    setCadenaLogo(null);
    setCantidadLocales('2');
    setDireccionesLocales(['', '']);
    setLocalesCreados([]);
    setOnboardingStep(1);
    setCreationType('local');
    setCantidadMesas('10');
    setCapacidadMesas('4');
    setProveedorNombre('Propio');
    setProveedorTelefono('');
    setProveedorEmail('');
    setNuevoProveedorId(null);
    setProductos([{ nombre: '', precio: '', costo: '' }]);
  };

  const agregarProducto = () => {
    setProductos([...productos, { nombre: '', precio: '', costo: '' }]);
  };

  const quitarProducto = (index: number) => {
    setProductos(productos.filter((_, i) => i !== index));
  };

  const actualizarProducto = (index: number, field: 'nombre' | 'precio' | 'costo', value: string) => {
    const nuevosProductos = [...productos];
    nuevosProductos[index][field] = value;
    setProductos(nuevosProductos);
  };

  const actualizarDireccionLocal = (index: number, value: string) => {
    const nuevasDirecciones = [...direccionesLocales];
    nuevasDirecciones[index] = value;
    setDireccionesLocales(nuevasDirecciones);
  };

  const validarDireccion = (direccion: string): boolean => {
    const palabras = direccion.trim().split(/\s+/);
    return palabras.length >= 3;
  };

  const handleCrearCadena = async () => {
    try {
      if (!cadenaNombre) {
        Alert.alert('Error', 'El nombre de la cadena es requerido');
        return;
      }
      const cantidad = parseInt(cantidadLocales);
      if (isNaN(cantidad) || cantidad < 1) {
        Alert.alert('Error', 'Cantidad de locales inválida');
        return;
      }
      
      // Validar direcciones
      for (let i = 0; i < cantidad; i++) {
        if (!direccionesLocales[i]) {
          Alert.alert('Error', `La dirección del local ${i + 1} es requerida`);
          return;
        }
        if (!validarDireccion(direccionesLocales[i])) {
          Alert.alert('Error', `La dirección del local ${i + 1} debe tener al menos 3 palabras (Ciudad, zona, calle_#)`);
          return;
        }
      }

      // Crear cada local de la cadena
      const idsCreados: string[] = [];
      const usuariosDeLocales: Array<{localId: string, usuarios: any[], localNombre: string}> = [];
      
      for (let i = 0; i < cantidad; i++) {
        const payload: any = {
          nombre: `${cadenaNombre} - ${direccionesLocales[i].split(',')[0].trim()}`,
          direccion: direccionesLocales[i],
          telefono: localTelefono || null,
          cadena: cadenaNombre
        };
        if (cadenaLogo) payload.logo = cadenaLogo;

        const response = await api.post('/locales', payload);
        const localId = response.data?.data?.local?.id?.toString();
        idsCreados.push(localId);
        
        // Guardar los usuarios generados
        usuariosDeLocales.push({
          localId: localId,
          usuarios: response.data?.data?.usuarios || [],
          localNombre: payload.nombre
        });
      }

      setLocalesCreados(idsCreados);
      setNuevoLocalId(idsCreados[0]); // Usar el primer local como referencia
      setUsuariosGenerados(usuariosDeLocales); // Guardar todos los usuarios para el resumen
      setOnboardingStep(2);
    } catch (e: any) {
      showErrorAlert(e, {
        onRetry: handleCrearCadena
      });
    }
  };

  if (showOnboarding) {
    // Onboarding wizard
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
        <ScrollView style={{ flex: 1, padding: 24, paddingTop: 60, paddingBottom: footerHeight + 12 }}>
          {onboardingStep === 1 && (
            <View>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: fg, marginBottom: 12 }}>Crear tu primer local</Text>
              
              <Text style={{ fontSize: 14, color: muted, marginBottom: 16, lineHeight: 20 }}>
                Todo empieza aquí, al crear tu local se cargará tu menú, proveedores, precios y costos (datos protegidos solo para ti), además se crearán 3 usuarios de diferente rol: mesero, cocina y bar.
                {'\n\n'}
                Si tienes varios locales con el mismo menú puedes elegir la opción: crear cadena de locales.
                {'\n\n'}
                Empezemos.....
              </Text>

              {/* Tabs */}
              <View style={{ flexDirection: 'row', marginBottom: 16, gap: 8 }}>
                <TouchableOpacity
                  onPress={() => setCreationType('local')}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: creationType === 'local' ? '#111827' : 'transparent',
                    borderWidth: 1,
                    borderColor: creationType === 'local' ? '#111827' : muted
                  }}
                >
                  <Text style={{ color: creationType === 'local' ? 'white' : fg, textAlign: 'center', fontWeight: '600' }}>
                    Crear local
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setCreationType('cadena')}
                  style={{
                    flex: 1,
                    padding: 12,
                    borderRadius: 8,
                    backgroundColor: creationType === 'cadena' ? '#111827' : 'transparent',
                    borderWidth: 1,
                    borderColor: creationType === 'cadena' ? '#111827' : muted
                  }}
                >
                  <Text style={{ color: creationType === 'cadena' ? 'white' : fg, textAlign: 'center', fontWeight: '600' }}>
                    Crear cadena de locales
                  </Text>
                </TouchableOpacity>
              </View>

              {creationType === 'local' ? (
                <View>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: muted, padding: 12, borderRadius: 8, marginBottom: 12, color: fg }}
                    placeholder="Nombre del local"
                    placeholderTextColor={muted}
                    value={localNombre}
                    onChangeText={setLocalNombre}
                  />
                  <TextInput
                    style={{ borderWidth: 1, borderColor: muted, padding: 12, borderRadius: 8, marginBottom: 12, color: fg }}
                    placeholder="Ciudad, zona, calle_#"
                    placeholderTextColor={muted}
                    value={localDireccion}
                    onChangeText={setLocalDireccion}
                  />
                  <TextInput
                    style={{ borderWidth: 1, borderColor: muted, padding: 12, borderRadius: 8, marginBottom: 12, color: fg }}
                    placeholder="Teléfono"
                    placeholderTextColor={muted}
                    value={localTelefono}
                    onChangeText={setLocalTelefono}
                  />
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                    <TouchableOpacity onPress={pickLogoFromLibrary} style={{ flex: 1, backgroundColor: '#3b82f6', padding: 12, borderRadius: 8 }}>
                      <Text style={{ color: 'white', textAlign: 'center' }}>Seleccionar logo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={takeLogoWithCamera} style={{ flex: 1, backgroundColor: '#10b981', padding: 12, borderRadius: 8 }}>
                      <Text style={{ color: 'white', textAlign: 'center' }}>Tomar foto</Text>
                    </TouchableOpacity>
                  </View>
                  {localLogo && <Image source={{ uri: localLogo }} style={{ width: 100, height: 100, alignSelf: 'center', marginBottom: 12 }} />}
                  <TouchableOpacity onPress={handleCrearLocal} style={{ backgroundColor: '#111827', padding: 14, borderRadius: 10 }}>
                    <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>Crear Local</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: muted, padding: 12, borderRadius: 8, marginBottom: 12, color: fg }}
                    placeholder="Nombre de la cadena"
                    placeholderTextColor={muted}
                    value={cadenaNombre}
                    onChangeText={setCadenaNombre}
                  />
                  <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                    <TouchableOpacity onPress={pickLogoFromLibrary} style={{ flex: 1, backgroundColor: '#3b82f6', padding: 12, borderRadius: 8 }}>
                      <Text style={{ color: 'white', textAlign: 'center' }}>Seleccionar logo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={takeLogoWithCamera} style={{ flex: 1, backgroundColor: '#10b981', padding: 12, borderRadius: 8 }}>
                      <Text style={{ color: 'white', textAlign: 'center' }}>Tomar foto</Text>
                    </TouchableOpacity>
                  </View>
                  {cadenaLogo && <Image source={{ uri: cadenaLogo }} style={{ width: 100, height: 100, alignSelf: 'center', marginBottom: 12 }} />}
                  <TextInput
                    style={{ borderWidth: 1, borderColor: muted, padding: 12, borderRadius: 8, marginBottom: 12, color: fg }}
                    placeholder="Cantidad de locales"
                    placeholderTextColor={muted}
                    value={cantidadLocales}
                    onChangeText={(val) => {
                      setCantidadLocales(val);
                      const cantidad = parseInt(val);
                      if (!isNaN(cantidad) && cantidad > 0) {
                        setDireccionesLocales(Array(cantidad).fill('').map((_, i) => direccionesLocales[i] || ''));
                      }
                    }}
                    keyboardType="numeric"
                  />
                  <Text style={{ fontSize: 16, fontWeight: '600', color: fg, marginBottom: 8 }}>Direcciones de cada local:</Text>
                  {Array.from({ length: parseInt(cantidadLocales) || 0 }).map((_, index) => (
                    <TextInput
                      key={index}
                      style={{ borderWidth: 1, borderColor: muted, padding: 12, borderRadius: 8, marginBottom: 8, color: fg }}
                      placeholder={`Local ${index + 1}: Ciudad, zona, calle_#`}
                      placeholderTextColor={muted}
                      value={direccionesLocales[index] || ''}
                      onChangeText={(val) => actualizarDireccionLocal(index, val)}
                    />
                  ))}
                  <TouchableOpacity onPress={handleCrearCadena} style={{ backgroundColor: '#111827', padding: 14, borderRadius: 10 }}>
                    <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>Crear Cadena</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
          {onboardingStep === 2 && (
            <View>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: fg, marginBottom: 16 }}>Configurar mesas</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: muted, padding: 12, borderRadius: 8, marginBottom: 12, color: fg }}
                placeholder="Cantidad de mesas"
                placeholderTextColor={muted}
                value={cantidadMesas}
                onChangeText={setCantidadMesas}
                keyboardType="numeric"
              />
              <TextInput
                style={{ borderWidth: 1, borderColor: muted, padding: 12, borderRadius: 8, marginBottom: 12, color: fg }}
                placeholder="Capacidad por mesa"
                placeholderTextColor={muted}
                value={capacidadMesas}
                onChangeText={setCapacidadMesas}
                keyboardType="numeric"
              />
              <TouchableOpacity onPress={handleCrearMesas} style={{ backgroundColor: '#111827', padding: 14, borderRadius: 10 }}>
                <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>Crear Mesas</Text>
              </TouchableOpacity>
            </View>
          )}
          {onboardingStep === 3 && (
            <View>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: fg, marginBottom: 16 }}>Crear proveedor</Text>
              <TextInput
                style={{ borderWidth: 1, borderColor: muted, padding: 12, borderRadius: 8, marginBottom: 12, color: fg }}
                placeholder="Nombre del proveedor"
                placeholderTextColor={muted}
                value={proveedorNombre}
                onChangeText={setProveedorNombre}
              />
              <TextInput
                style={{ borderWidth: 1, borderColor: muted, padding: 12, borderRadius: 8, marginBottom: 12, color: fg }}
                placeholder="Teléfono"
                placeholderTextColor={muted}
                value={proveedorTelefono}
                onChangeText={setProveedorTelefono}
              />
              <TextInput
                style={{ borderWidth: 1, borderColor: muted, padding: 12, borderRadius: 8, marginBottom: 12, color: fg }}
                placeholder="Email"
                placeholderTextColor={muted}
                value={proveedorEmail}
                onChangeText={setProveedorEmail}
              />
              <TouchableOpacity onPress={handleCrearProveedor} style={{ backgroundColor: '#111827', padding: 14, borderRadius: 10 }}>
                <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>Crear Proveedor</Text>
              </TouchableOpacity>
            </View>
          )}
          {onboardingStep === 4 && (
            <View>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: fg, marginBottom: 16 }}>Agregar productos iniciales</Text>
              {productos.map((producto, index) => (
                <View key={index} style={{ marginBottom: 12 }}>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: muted, padding: 12, borderRadius: 8, marginBottom: 8, color: fg }}
                    placeholder="Nombre del producto"
                    placeholderTextColor={muted}
                    value={producto.nombre}
                    onChangeText={(value) => actualizarProducto(index, 'nombre', value)}
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      style={{ flex: 1, borderWidth: 1, borderColor: muted, padding: 12, borderRadius: 8, color: fg }}
                      placeholder="Precio"
                      placeholderTextColor={muted}
                      value={producto.precio}
                      onChangeText={(value) => actualizarProducto(index, 'precio', value)}
                      keyboardType="numeric"
                    />
                    <TextInput
                      style={{ flex: 1, borderWidth: 1, borderColor: muted, padding: 12, borderRadius: 8, color: fg }}
                      placeholder="Costo"
                      placeholderTextColor={muted}
                      value={producto.costo}
                      onChangeText={(value) => actualizarProducto(index, 'costo', value)}
                      keyboardType="numeric"
                    />
                    {productos.length > 1 && (
                      <TouchableOpacity onPress={() => quitarProducto(index)} style={{ backgroundColor: '#ef4444', padding: 12, borderRadius: 8 }}>
                        <Text style={{ color: 'white' }}>X</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
              <TouchableOpacity onPress={agregarProducto} style={{ backgroundColor: '#10b981', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                <Text style={{ color: 'white', textAlign: 'center' }}>Agregar producto</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCrearProductos} style={{ backgroundColor: '#111827', padding: 14, borderRadius: 10 }}>
                <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>Finalizar configuración</Text>
              </TouchableOpacity>
            </View>
          )}
          {onboardingStep === 5 && (
            <View>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: fg, marginBottom: 16 }}>Resumen de Cadena</Text>
              <Text style={{ fontSize: 16, color: fg, marginBottom: 12 }}>
                Se han creado exitosamente <Text style={{ fontWeight: 'bold' }}>{localesCreados.length}</Text> locales:
              </Text>
              {usuariosGenerados.map((localData, index) => (
                <View key={index} style={{ backgroundColor: dark ? '#1F2937' : '#F3F4F6', padding: 12, borderRadius: 8, marginBottom: 8 }}>
                  <Text style={{ color: fg, fontWeight: '600', marginBottom: 4 }}>
                    {localData.localNombre}
                  </Text>
                  <Text style={{ color: muted, fontSize: 12 }}>
                    {direccionesLocales[index]}
                  </Text>
                  <Text style={{ color: muted, fontSize: 12, marginTop: 4 }}>
                    Usuarios creados:
                  </Text>
                  {localData.usuarios.map((usuario, uIndex) => (
                    <Text key={uIndex} style={{ color: muted, fontSize: 11 }}>
                      • {usuario.email} ({usuario.tipo})
                    </Text>
                  ))}
                </View>
              ))}
              <Text style={{ fontSize: 14, color: muted, marginTop: 8, marginBottom: 16 }}>
                Total: {cantidadMesas} mesas por local • {productos.filter(p => p.nombre).length} productos en menú compartido
              </Text>
              <TouchableOpacity 
                onPress={async () => {
                  const data = await localService.obtenerLocales();
                  setLocales(Array.isArray(data) ? data : data?.locales || data?.data || []);
                  setShowOnboarding(false);
                  resetearOnboarding();
                  Alert.alert('¡Éxito!', 'Cadena configurada correctamente');
                }}
                style={{ backgroundColor: '#111827', padding: 14, borderRadius: 10 }}
              >
                <Text style={{ color: 'white', textAlign: 'center', fontWeight: '700' }}>Finalizar</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: footerHeight, backgroundColor: bg, justifyContent: 'center', alignItems: 'center' }}>
          {lightFooterLogo && darkFooterLogo ? (
            <Image source={dark ? darkFooterLogo : lightFooterLogo} style={{ height: footerHeight * 0.6, resizeMode: 'contain' }} />
          ) : (
            <Text style={{ color: muted, fontSize: 12 }}>MalaFama</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Local selection
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
      <TopNav title="Admin" onOpenSettings={() => {}} />
      
      <ScrollView style={{ flex: 1, padding: 24, paddingBottom: footerHeight + 12 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: fg, marginBottom: 16 }}>Selecciona tu local</Text>
        <FlatList
          data={locales}
          scrollEnabled={false}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleSelectLocal(item)}
              style={{ flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#111827', padding: 16, borderRadius: 10, marginBottom: 12 }}
            >
              {(item.logo || item.logo_url) ? (
                <Image source={{ uri: (item.logo || item.logo_url)! }} style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: '#fff' }} />
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={{ color: 'white', fontSize: 18, fontWeight: '600' }}>{item.nombre}</Text>
                <Text style={{ color: '#9CA3AF', marginTop: 4 }}>{item.direccion}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ color: muted, textAlign: 'center', marginBottom: 20 }}>No hay locales disponibles</Text>
              <TouchableOpacity 
                onPress={() => setShowOnboarding(true)}
                style={{ 
                  backgroundColor: '#111827', 
                  paddingHorizontal: 16, 
                  paddingVertical: 10,
                  borderRadius: 8
                }}
              >
                <Text style={{ color: 'white', fontWeight: '600' }}>Crear nuevo local</Text>
              </TouchableOpacity>
            </View>
          }
          ListFooterComponent={
            locales.length > 0 ? (
              <TouchableOpacity 
                onPress={() => setShowOnboarding(true)}
                style={{ 
                  backgroundColor: '#10b981', 
                  paddingVertical: 12,
                  borderRadius: 8,
                  alignItems: 'center',
                  marginTop: 12
                }}
              >
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>+ Agregar Local</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      </ScrollView>

      {/* Footer con logo */}
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: footerHeight, backgroundColor: bg, justifyContent: 'center', alignItems: 'center' }}>
        {lightFooterLogo && darkFooterLogo ? (
          <Image source={dark ? darkFooterLogo : lightFooterLogo} style={{ height: footerHeight * 0.6, resizeMode: 'contain' }} />
        ) : (
          <Text style={{ color: muted, fontSize: 12 }}>MalaFama</Text>
        )}
      </View>
    </SafeAreaView>
  );
}