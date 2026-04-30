import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import onboardingService from '../../services/onboardingService';
import proveedorService from '../../services/proveedorService';
import localService from '../../services/localService';
import { mesaService } from '../../services/mesaService';
import LoadingSpinner from '../../components/LoadingSpinner';
import Paso0Local from '../../components/onboarding/Paso0Local';
import Paso1Mesas from './steps/Paso1Mesas';
import Paso2Productos from './steps/Paso2Productos';
import Paso3CostoProveedor from './steps/Paso3CostoProveedor';

const PASOS = [
  { numero: 0, titulo: 'Crear Local', descripcion: 'Configura la información de tu restaurante' },
  { numero: 1, titulo: 'Configurar Mesas', descripcion: 'Indica cuántas mesas tiene tu restaurante' },
  { numero: 2, titulo: 'Crear Productos', descripcion: 'Importa tu menú o crea productos manualmente' },
  { numero: 3, titulo: 'Asignar Costos', descripcion: 'Define costos y proveedores para tus productos' }
];

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const [pasoActual, setPasoActual] = useState(0);
  const [loading, setLoading] = useState(true);
  const [proveedores, setProveedores] = useState([]);
  const [mostrarDialogExistente, setMostrarDialogExistente] = useState(false);
  const [configuracionExistente, setConfiguracionExistente] = useState(null);
  
  // Estado de cada paso
  const [localCreado, setLocalCreado] = useState(null);
  const [datosMesas, setDatosMesas] = useState(null);
  const [datosProductos, setDatosProductos] = useState([]);
  const [productosScrapeados, setProductosScrapeados] = useState([]);
  const [monedaLocal, setMonedaLocal] = useState('Bs'); // Currency from Paso 0

  useEffect(() => {
    verificarConfiguracionExistente();
  }, [location.key]);

  const isNuevoLocalFlow = () => {
    if (location.state?.nuevoLocal) return true;
    const params = new URLSearchParams(location.search);
    const value = params.get('nuevoLocal');
    return value === '1' || value === 'true';
  };

  const verificarConfiguracionExistente = async () => {
    try {
      setLoading(true);

      // Si el usuario eligió explícitamente crear un nuevo local,
      // no mostramos el diálogo de configuración existente.
      if (isNuevoLocalFlow()) {
        setMostrarDialogExistente(false);
        setConfiguracionExistente(null);
        setLocalCreado(null);
        setDatosMesas(null);
        setDatosProductos([]);
        setProductosScrapeados([]);
        setPasoActual(0);
        await cargarProveedores();
        return;
      }
      
      // Verificar si ya existe un local
      const responseLocales = await localService.obtenerLocales();
      const locales = responseLocales.data?.locales || responseLocales.data || [];
      
      // Verificar si ya existen mesas
      const responseMesas = await mesaService.getAll();
      const mesas = responseMesas.data?.mesas || responseMesas.data || [];

      if (locales.length > 0 || mesas.length > 0) {
        setConfiguracionExistente({
          local: locales[0] || null,
          mesasCount: mesas.length
        });
        setMostrarDialogExistente(true);
        
        // Si existe local, guardarlo
        if (locales[0]) {
          setLocalCreado(locales[0]);
        }
      } else {
        // No hay configuración existente, continuar normal
        await cargarProveedores();
      }
    } catch (error) {
      console.error('Error al verificar configuración:', error);
      // Si hay error, asumir que no hay configuración y continuar
      await cargarProveedores();
    } finally {
      setLoading(false);
    }
  };

  const handleContinuarConfiguracion = async () => {
    setMostrarDialogExistente(false);
    await cargarProveedores();
    
    // Si existe local, guardar su moneda
    if (configuracionExistente?.local) {
      setMonedaLocal(configuracionExistente.local.moneda || 'Bs');
    }
    
    // Determinar en qué paso continuar basado en la configuración existente
    if (configuracionExistente?.local && configuracionExistente?.mesasCount > 0) {
      // Si ya tiene local y mesas, ir directo al paso de productos
      setPasoActual(2);
    } else if (configuracionExistente?.local) {
      // Si solo tiene local, ir al paso de mesas
      setPasoActual(1);
    } else {
      // Si solo tiene mesas pero no local (caso raro), empezar desde el principio
      setPasoActual(0);
    }
  };

  const handleIrADashboard = () => {
    navigate('/admin/dashboard');
  };

  const cargarProveedores = async () => {
    try {
      const response = await proveedorService.getAll();
      setProveedores(response.data.proveedores || response.data || []);
    } catch (error) {
      console.error('Error al cargar proveedores:', error);
      setProveedores([]);
    }
  };

  const handleCompletarPaso0 = async (datos) => {
    setLoading(true);
    try {
      const response = await localService.crearLocal(datos);
      
      // Extraer el local y usuarios del data
      const local = response.data.local || response.data;
      const usuarios = response.data.usuarios || [];
      const credenciales = response.data.credenciales || {};
      
      // Guardar moneda para usarla en los siguientes pasos
      setMonedaLocal(datos.moneda || 'Bs');
      
      // Mostrar mensaje con credenciales
      if (usuarios.length > 0 && credenciales.passwordPorDefecto) {
        toast.success(
          `✅ Local "${datos.nombre}" creado\n\n` +
          `👥 ${usuarios.length} usuarios creados:\n` +
          usuarios.map(u => `• ${u.nombre}: ${u.email}`).join('\n') +
          `\n\n🔑 Password: ${credenciales.passwordPorDefecto}`,
          { duration: 10000 }
        );
      } else {
        toast.success(`✅ Local "${datos.nombre}" creado exitosamente`);
      }
      
      setLocalCreado(local);
      setPasoActual(1);
    } catch (error) {
      console.error('Error al crear local:', error);
      toast.error(error.response?.data?.message || 'Error al crear local');
    } finally {
      setLoading(false);
    }
  };

  const handleCompletarPaso1 = async (datos) => {
    setLoading(true);
    try {
      const response = await onboardingService.crearMesas(
        datos.cantidad,
        datos.ubicacion,
        datos.capacidad,
        localCreado.id // Pasar el ID del local creado
      );
      
      toast.success(`✅ ${response.data.total} mesas creadas`);
      setDatosMesas(datos);
      setPasoActual(2);
    } catch (error) {
      console.error('Error al crear mesas:', error);
      toast.error(error.response?.data?.message || 'Error al crear mesas');
    } finally {
      setLoading(false);
    }
  };

  const handleCompletarPaso2 = async (datos) => {
    setDatosProductos(datos.productos);
    setProductosScrapeados(datos.scrapeados || []);
    setPasoActual(3);
  };

  const handleCompletarPaso3 = async (productosConCosto) => {
    setLoading(true);
    try {
      // Si hay productos scrapeados, usar endpoint de importar
      // Si son manuales, usar endpoint de bulk create
      let response;
      
      if (productosScrapeados.length > 0) {
        response = await onboardingService.importarProductos(productosConCosto, localCreado.id);
      } else {
        response = await onboardingService.crearProductosBulk(productosConCosto, localCreado.id);
      }

      toast.success(`✅ ${response.data.total} productos creados`);

      // Completar onboarding
      await onboardingService.completarOnboarding();
      
      toast.success('🎉 ¡Configuración completada! Redirigiendo al dashboard...');
      
      setTimeout(() => {
        navigate('/admin/dashboard');
      }, 2000);
    } catch (error) {
      console.error('Error al completar onboarding:', error);
      toast.error(error.response?.data?.message || 'Error al completar configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleRetroceder = () => {
    if (pasoActual > 0) {
      setPasoActual(pasoActual - 1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900">
        <LoadingSpinner text="Verificando configuración..." />
      </div>
    );
  }

  // Dialog de configuración existente
  if (mostrarDialogExistente) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 to-slate-900 px-4">
        <div className="bg-slate-800 rounded-lg shadow-xl p-8 max-w-md w-full">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-900/30 rounded-full mb-4">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-100 mb-2">
              Configuración Detectada
            </h2>
            <p className="text-slate-400">
              Ya tienes configuración existente
            </p>
          </div>

          <div className="bg-blue-900/20 rounded-lg p-4 mb-6">
            {configuracionExistente?.local && (
              <div className="mb-3">
                <p className="text-sm font-semibold text-blue-900">🏪 Local encontrado:</p>
                <p className="text-sm text-blue-800">{configuracionExistente.local.nombre}</p>
              </div>
            )}
            {configuracionExistente?.mesasCount > 0 && (
              <div>
                <p className="text-sm font-semibold text-blue-900 flex items-center gap-1"><img src="/mesa.png" className="inline w-4 h-4 object-contain" alt="mesa" /> Mesas configuradas:</p>
                <p className="text-sm text-blue-800">{configuracionExistente.mesasCount} mesas</p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <button
              onClick={handleContinuarConfiguracion}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
            >
              Continuar Configuración
            </button>
            <button
              onClick={handleIrADashboard}
              className="w-full px-6 py-3 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-900 font-medium transition-colors"
            >
              Ir al Dashboard
            </button>
          </div>

          <p className="text-xs text-slate-400 text-center mt-4">
            Si continúas la configuración, podrás agregar más productos o proveedores
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 to-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-100 mb-2">
            ¡Bienvenido a MalaFama! 🍕
          </h1>
          <p className="text-lg text-slate-400">
            Configuremos tu restaurante en 4 simples pasos
          </p>
        </div>

        {/* Progress Bar */}
        <div className="bg-slate-800 rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            {PASOS.map((paso, index) => (
              <div key={paso.numero} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                      pasoActual === paso.numero
                        ? 'bg-blue-600 text-white'
                        : pasoActual > paso.numero
                        ? 'bg-green-500 text-white'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {pasoActual > paso.numero ? '✓' : paso.numero}
                  </div>
                  <div className="mt-2 text-center">
                    <p className="text-sm font-medium text-slate-100">{paso.titulo}</p>
                    <p className="text-xs text-slate-400 mt-1">{paso.descripcion}</p>
                  </div>
                </div>
                {index < PASOS.length - 1 && (
                  <div
                    className={`h-1 flex-1 mx-4 ${
                      pasoActual > paso.numero ? 'bg-green-500' : 'bg-slate-700'
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contenido del paso actual */}
        <div className="bg-slate-800 rounded-lg shadow-md p-8">
          {pasoActual === 0 && (
            <Paso0Local
              onCompletar={handleCompletarPaso0}
              datosIniciales={localCreado}
            />
          )}

          {pasoActual === 1 && (
            <Paso1Mesas
              onCompletar={handleCompletarPaso1}
              onRetroceder={handleRetroceder}
              datosIniciales={datosMesas}
            />
          )}
          
          {pasoActual === 2 && (
            <Paso2Productos
              onCompletar={handleCompletarPaso2}
              onRetroceder={handleRetroceder}
              datosIniciales={datosProductos}
              moneda={monedaLocal}
            />
          )}
          
          {pasoActual === 3 && (
            <Paso3CostoProveedor
              productos={datosProductos}
              productosScrapeados={productosScrapeados}
              proveedores={proveedores}
              moneda={monedaLocal}
              localId={localCreado?.id || null}
              onCompletar={handleCompletarPaso3}
              onRetroceder={handleRetroceder}
            />
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-slate-400">
          <p>Puedes editar esta configuración más tarde desde el panel de administración</p>
        </div>
      </div>
    </div>
  );
}
