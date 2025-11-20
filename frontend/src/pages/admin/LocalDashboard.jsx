import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { useLocalStore } from '../../store/localStore';
import { toast } from 'react-hot-toast';
import Navbar from '../../components/Navbar';
import LocalSelector from '../../components/LocalSelector';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import localService from '../../services/localService';
import { mesaService } from '../../services/mesaService';
import productoService from '../../services/productoService';
import proveedorService from '../../services/proveedorService';
import dashboardService from '../../services/dashboardService';
import LoadingSpinner from '../../components/LoadingSpinner';

// Registrar componentes de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

export default function LocalDashboard() {
  const navigate = useNavigate();
  const { localId } = useParams();
  const { user, setUser } = useAuthStore();
  const { localActivo, setLocalActivo, locales } = useLocalStore();
  const [loading, setLoading] = useState(true);
  const [mostrarConfigMoneda, setMostrarConfigMoneda] = useState(false);
  const [monedaSeleccionada, setMonedaSeleccionada] = useState('Bs');
  const [stats, setStats] = useState({
    local: null,
    totalMesas: 0,
    totalProductos: 0,
    totalProveedores: 0,
    mesasOcupadas: 0,
    pedidosActivos: 0,
    ventasHoy: 0,
    productosMasVendidos: [],
    ventasUltimos7Dias: []
  });

  useEffect(() => {
    // Solo cargar una vez al montar el componente
    let isActive = true;
    
    const cargarInicial = async () => {
      if (!isActive) return;
      
      // Cargar el local específico si viene del parámetro
      if (localId) {
        await cargarLocalPorId(localId);
      }
      
      if (isActive) {
        await cargarDashboard();
      }
      
      // Inicializar moneda seleccionada
      const moneda = localActivo?.moneda || user?.local?.moneda || 'Bs';
      if (isActive) {
        setMonedaSeleccionada(moneda);
      }
    };
    
    cargarInicial();
    
    // Cleanup para evitar actualizaciones si el componente se desmonta
    return () => {
      isActive = false;
    };
  }, []); // Sin dependencias para evitar loops
  
  // Efecto separado solo para actualizar moneda cuando cambia el local
  useEffect(() => {
    if (localActivo?.moneda) {
      setMonedaSeleccionada(localActivo.moneda);
    }
  }, [localActivo?.id]); // Solo cuando cambia el ID del local

  const cargarLocalPorId = async (id) => {
    try {
      const response = await localService.obtenerLocalPorId(id);
      const local = response.data?.local || response.data;
      if (local) {
        setLocalActivo(local);
      }
    } catch (error) {
      console.error('Error al cargar local:', error);
      toast.error('Error al cargar el local');
    }
  };

  const handleLocalChange = (local) => {
    setLocalActivo(local);
    setMonedaSeleccionada(local.moneda || 'Bs');
    navigate(`/admin/local/${local.id}`);
    cargarDashboard();
  };

  const cargarDashboard = async () => {
    try {
      setLoading(true);
      
      // Cargar datos en paralelo
      const [
        responseLocales,
        responseMesas,
        responseProductos,
        responseProveedores
      ] = await Promise.all([
        localService.obtenerLocales(),
        mesaService.getAll(),
        productoService.getAll({ activo: true }),
        proveedorService.getAll()
      ]);

      const locales = responseLocales.data?.locales || responseLocales.data || [];
      
      // Usar el local activo para las métricas
      let local = localActivo;
      if (!local && localId) {
        local = locales.find(l => l.id === localId);
      }
      if (!local) {
        local = locales[0] || user?.local || null;
      }
      
      // NO actualizar localActivo aquí, solo cargar stats
      // El localActivo se actualiza solo en cargarLocalPorId
      
      const mesas = responseMesas.data?.mesas || responseMesas.data || [];
      const productos = responseProductos.data?.productos || responseProductos.data || [];
      const proveedores = responseProveedores.data?.proveedores || responseProveedores.data || [];

      // Cargar métricas en tiempo real si hay un local
      let metrics = {
        pedidosActivos: 0,
        ventasHoy: 0,
        mesasOcupadas: 0,
        productosMasVendidos: [],
        ventasUltimos7Dias: []
      };

      if (local && local.id) {
        try {
          const responseMetrics = await dashboardService.getMetrics(local.id);
          metrics = responseMetrics.data || metrics;
        } catch (error) {
          console.error('Error al cargar métricas:', error);
          // Continuar sin métricas en tiempo real
        }
      }

      setStats({
        local,
        totalMesas: mesas.length,
        totalProductos: productos.length,
        totalProveedores: proveedores.length,
        ...metrics
      });
    } catch (error) {
      console.error('Error al cargar dashboard:', error);
      toast.error('Error al cargar información del dashboard');
    } finally {
      setLoading(false);
    }
  };

  const actualizarMoneda = async () => {
    const local = localActivo || stats.local;
    if (!local?.id) {
      toast.error('No hay local seleccionado');
      return;
    }

    try {
      await localService.actualizarLocal(local.id, { moneda: monedaSeleccionada });
      
      // Actualizar el local activo
      if (localActivo) {
        setLocalActivo({ ...localActivo, moneda: monedaSeleccionada });
      }
      
      // Si es el local del usuario, actualizar también el usuario
      if (user?.local?.id === local.id) {
        const updatedUser = {
          ...user,
          local: {
            ...user.local,
            moneda: monedaSeleccionada
          }
        };
        setUser(updatedUser);
      }
      
      toast.success(`Moneda actualizada a ${monedaSeleccionada}`);
      setMostrarConfigMoneda(false);
      await cargarDashboard();
    } catch (error) {
      console.error('Error al actualizar moneda:', error);
      toast.error('Error al actualizar la moneda');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner text="Cargando dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <Navbar />

      {/* Header Info - Mobile Optimized */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Botón Volver */}
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-medium hidden sm:inline">Volver a Locales</span>
            </button>
            
            <div className="flex items-center gap-3 min-w-0 flex-1 justify-center">
              {stats.local?.logo && (
                <img
                  src={stats.local.logo}
                  alt={stats.local.nombre}
                  className="w-12 h-12 sm:w-16 sm:h-16 object-contain flex-shrink-0"
                />
              )}
              <div className="min-w-0">
                <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
                  {stats.local?.nombre || 'Mi Local'}
                </h1>
                <p className="text-xs sm:text-sm text-gray-600">Panel de Administración</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Selector de Local (solo si tiene múltiples) */}
              <LocalSelector onLocalChange={handleLocalChange} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Mensaje si no hay local */}
        {!stats.local && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 sm:p-6 mb-6 sm:mb-8 rounded-lg">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-6 w-6 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-lg font-medium text-yellow-800">
                  No tienes locales configurados
                </h3>
                <p className="mt-2 text-sm text-yellow-700">
                  Para comenzar a usar el sistema, necesitas crear tu primer local. El asistente te guiará paso a paso para configurar tu restaurante, mesas, productos y más.
                </p>
                <div className="mt-4">
                  <button
                    onClick={() => navigate('/onboarding')}
                    className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium inline-flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Iniciar Configuración
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          {/* Mesas */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6">
            <div className="flex items-center justify-between mb-2 sm:mb-4">
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 sm:w-6 sm:h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="hidden sm:inline text-sm text-gray-500">Ocupadas: {stats.mesasOcupadas}</span>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.totalMesas}</p>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">Mesas <span className="sm:hidden">({stats.mesasOcupadas} ocup.)</span><span className="hidden sm:inline">totales</span></p>
          </div>

          {/* Productos */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6">
            <div className="flex items-center justify-between mb-2 sm:mb-4">
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 sm:w-6 sm:h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.totalProductos}</p>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">Productos<span className="hidden sm:inline"> activos</span></p>
          </div>

          {/* Proveedores */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6">
            <div className="flex items-center justify-between mb-2 sm:mb-4">
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 sm:w-6 sm:h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900">{stats.totalProveedores}</p>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">Proveedores</p>
          </div>

          {/* Local Status */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6">
            <div className="flex items-center justify-between mb-2 sm:mb-4">
              <div className="w-8 h-8 sm:w-12 sm:h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 sm:w-6 sm:h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-xl sm:text-3xl font-bold text-green-600">Activo</p>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">Estado<span className="hidden sm:inline"> del local</span></p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6 mb-6 sm:mb-8">
          <h2 className="text-base sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">🚀 Accesos Rápidos</h2>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
            <button
              onClick={() => navigate('/admin/productos')}
              className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-all text-left"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-xs sm:text-base truncate">Productos</p>
                <p className="text-xs text-gray-500 hidden sm:block">Ver, editar y crear productos</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/admin/mesas')}
              className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-all text-left"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-xs sm:text-base truncate">Mesas</p>
                <p className="text-xs text-gray-500 hidden sm:block">Configurar mesas del local</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/admin/proveedores')}
              className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-all text-left"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-xs sm:text-base truncate">Proveedores</p>
                <p className="text-xs text-gray-500 hidden sm:block">Administrar proveedores</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/admin/usuarios')}
              className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-all text-left"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-yellow-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-xs sm:text-base truncate">Usuarios</p>
                <p className="text-xs text-gray-500 hidden sm:block">Meseros, cocina y más</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/admin/reportes')}
              className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-blue-300 transition-all text-left"
            >
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-xs sm:text-base truncate">Reportes</p>
                <p className="text-xs text-gray-500 hidden sm:block">Análisis y estadísticas</p>
              </div>
            </button>
          </div>
        </div>

        {/* Métricas en Tiempo Real */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6 mb-6 sm:mb-8">
          {/* Gráfica de Ventas Últimos 7 Días */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6">
            <h2 className="text-base sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">📈 Ventas <span className="hidden sm:inline">Últimos </span>7 Días</h2>
            {stats.ventasUltimos7Dias.length > 0 ? (
              <div style={{ height: '250px' }} className="sm:h-[300px]">
                <Line
                  data={{
                    labels: stats.ventasUltimos7Dias.map(v => {
                      const fecha = new Date(v.fecha);
                      return fecha.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' });
                    }),
                    datasets: [
                      {
                        label: `Ventas (${monedaSeleccionada})`,
                        data: stats.ventasUltimos7Dias.map(v => v.total),
                        borderColor: 'rgb(59, 130, 246)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        fill: true
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => `${monedaSeleccionada} ${context.parsed.y.toFixed(2)}`
                        }
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          callback: (value) => `${monedaSeleccionada} ${value}`,
                          font: {
                            size: window.innerWidth < 640 ? 10 : 12
                          }
                        }
                      },
                      x: {
                        ticks: {
                          font: {
                            size: window.innerWidth < 640 ? 10 : 12
                          }
                        }
                      }
                    }
                  }}
                />
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8 sm:py-12 text-sm sm:text-base">No hay datos de ventas aún</p>
            )}
          </div>

          {/* Productos Más Vendidos */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6">
            <h2 className="text-base sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">🏆 Más Vendidos <span className="hidden sm:inline">(30 días)</span></h2>
            {stats.productosMasVendidos.length > 0 ? (
              <div style={{ height: '250px' }} className="sm:h-[300px]">
                <Bar
                  data={{
                    labels: stats.productosMasVendidos.map(p => p.nombre),
                    datasets: [
                      {
                        label: 'Unidades Vendidas',
                        data: stats.productosMasVendidos.map(p => p.totalVendido),
                        backgroundColor: [
                          'rgba(59, 130, 246, 0.8)',
                          'rgba(16, 185, 129, 0.8)',
                          'rgba(249, 115, 22, 0.8)',
                          'rgba(139, 92, 246, 0.8)',
                          'rgba(236, 72, 153, 0.8)'
                        ],
                        borderColor: [
                          'rgb(59, 130, 246)',
                          'rgb(16, 185, 129)',
                          'rgb(249, 115, 22)',
                          'rgb(139, 92, 246)',
                          'rgb(236, 72, 153)'
                        ],
                        borderWidth: 2
                      }
                    ]
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false
                      },
                      tooltip: {
                        callbacks: {
                          label: (context) => `${context.parsed.y} unidades`
                        }
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          precision: 0,
                          font: {
                            size: window.innerWidth < 640 ? 10 : 12
                          }
                        }
                      },
                      x: {
                        ticks: {
                          font: {
                            size: window.innerWidth < 640 ? 10 : 12
                          }
                        }
                      }
                    }
                  }}
                />
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8 sm:py-12 text-sm sm:text-base">No hay datos de productos vendidos aún</p>
            )}
          </div>
        </div>

        {/* Métricas Adicionales */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm p-4 sm:p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm sm:text-lg font-semibold">💰 Ventas Hoy</h3>
              <svg className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-2xl sm:text-4xl font-bold">{monedaSeleccionada} {stats.ventasHoy.toFixed(2)}</p>
            <p className="text-blue-100 text-xs sm:text-sm mt-1">Total de ventas completadas</p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-sm p-4 sm:p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm sm:text-lg font-semibold">📋 Pedidos <span className="hidden sm:inline">Activos</span></h3>
              <svg className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <p className="text-2xl sm:text-4xl font-bold">{stats.pedidosActivos}</p>
            <p className="text-green-100 text-xs sm:text-sm mt-1">Comandas <span className="hidden sm:inline">abiertas</span></p>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-sm p-4 sm:p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm sm:text-lg font-semibold">🪑 Ocupación</h3>
              <svg className="w-6 h-6 sm:w-8 sm:h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-2xl sm:text-4xl font-bold">{stats.mesasOcupadas}/{stats.totalMesas}</p>
            <p className="text-purple-100 text-xs sm:text-sm mt-1">
              {stats.totalMesas > 0 ? `${((stats.mesasOcupadas / stats.totalMesas) * 100).toFixed(0)}% <span className="hidden sm:inline">ocupación</span>` : 'No hay mesas'}
            </p>
          </div>
        </div>

        {/* Local Info */}
        {stats.local && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 sm:p-6">
            <h2 className="text-base sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">📍 Información del Local</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Nombre</p>
                <p className="font-semibold text-gray-900 text-sm sm:text-base">{stats.local.nombre}</p>
              </div>
              {stats.local.direccion && (
                <div>
                  <p className="text-xs sm:text-sm text-gray-500">Dirección</p>
                  <p className="font-semibold text-gray-900 text-sm sm:text-base">{stats.local.direccion}</p>
                </div>
              )}
              {stats.local.telefono && (
                <div>
                  <p className="text-xs sm:text-sm text-gray-500">Teléfono</p>
                  <p className="font-semibold text-gray-900 text-sm sm:text-base">{stats.local.telefono}</p>
                </div>
              )}
              {stats.local.email && (
                <div>
                  <p className="text-xs sm:text-sm text-gray-500">Email</p>
                  <p className="font-semibold text-gray-900 text-sm sm:text-base">{stats.local.email}</p>
                </div>
              )}
              <div>
                <p className="text-xs sm:text-sm text-gray-500">Moneda</p>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900 text-sm sm:text-base">{localActivo?.moneda || stats.local?.moneda || user?.local?.moneda || 'Bs'}</p>
                  <button
                    onClick={() => setMostrarConfigMoneda(true)}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium"
                  >
                    Cambiar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal de Configuración de Moneda */}
      {mostrarConfigMoneda && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 rounded-t-2xl">
              <h2 className="text-xl font-bold">💱 Configurar Moneda</h2>
              <p className="text-sm text-blue-100">Selecciona la moneda de tu local</p>
            </div>
            
            <div className="p-6">
              <div className="space-y-3">
                {[
                  { code: 'Bs', name: 'Bolivianos (Bs)', flag: '🇧🇴' },
                  { code: '$', name: 'Dólares ($)', flag: '🇺🇸' },
                  { code: 'S/', name: 'Soles (S/)', flag: '🇵🇪' },
                  { code: '€', name: 'Euros (€)', flag: '🇪🇺' },
                  { code: 'AR$', name: 'Pesos Argentinos (AR$)', flag: '🇦🇷' },
                  { code: 'R$', name: 'Reales (R$)', flag: '🇧🇷' }
                ].map(({ code, name, flag }) => (
                  <button
                    key={code}
                    onClick={() => setMonedaSeleccionada(code)}
                    className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                      monedaSeleccionada === code
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{flag}</span>
                        <div>
                          <p className={`font-bold ${monedaSeleccionada === code ? 'text-blue-700' : 'text-gray-900'}`}>
                            {code}
                          </p>
                          <p className="text-sm text-gray-600">{name}</p>
                        </div>
                      </div>
                      {monedaSeleccionada === code && (
                        <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            <div className="px-6 pb-6 flex gap-3">
              <button
                onClick={() => setMostrarConfigMoneda(false)}
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={actualizarMoneda}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-colors shadow-lg"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
