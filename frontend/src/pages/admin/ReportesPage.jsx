import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line, Bar, Pie } from 'react-chartjs-2';
import { useAuthStore } from '../../store/authStore';
import LoadingSpinner from '../../components/LoadingSpinner';
import api from '../../services/api';
import localService from '../../services/localService';

// Registrar componentes de Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// Agregar estilos de animación
const fadeInStyle = `
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fadeIn {
  animation: fadeIn 0.6s ease-out forwards;
}
`;

// Insertar estilos en el documento
if (typeof document !== 'undefined') {
  const styleTag = document.createElement('style');
  styleTag.textContent = fadeInStyle;
  if (!document.head.querySelector('style[data-reportes-animations]')) {
    styleTag.setAttribute('data-reportes-animations', 'true');
    document.head.appendChild(styleTag);
  }
}

export default function ReportesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [periodo, setPeriodo] = useState('mensual');
  const [reporte, setReporte] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loadingScheduled, setLoadingScheduled] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [vistaActiva, setVistaActiva] = useState('resumen'); // resumen, productos, categorias, tipos
  const [localId, setLocalId] = useState(null);
  const [locales, setLocales] = useState([]);
  const [tipoReporte, setTipoReporte] = useState('ejecutivo'); // ejecutivo, detallado, comparativo
  const [showLocalModal, setShowLocalModal] = useState(false);

  useEffect(() => {
    // Cargar lista de locales
    cargarLocales();
    // Usar el localId del usuario directamente
    if (user?.localId) {
      setLocalId(user.localId);
    } else {
      // Si no tiene localId en el user, intentar cargar de la lista de locales
      cargarLocalId();
    }
    cargarSchedules();
  }, [user]);

  const cargarLocales = async () => {
    try {
      const response = await localService.obtenerLocales();
      // La API puede devolver response.data.locales o response.data directamente
      const localesData = response.data?.locales || response.data || [];
      setLocales(localesData);
      return localesData;
    } catch (error) {
      console.error('Error al cargar locales:', error);
      return [];
    }
  };

  const cargarLocalId = async () => {
    try {
      const response = await localService.obtenerLocales();
      const localesData = response.data?.locales || response.data || [];
      if (localesData.length > 0) {
        setLocalId(localesData[0].id);
        setLocales(localesData);
        return localesData;
      }
      return [];
    } catch (error) {
      console.error('Error al cargar local:', error);
      toast.error('Error al cargar configuración');
      return [];
    }
  };

  const cargarReporte = async () => {
    if (!periodo) {
      toast.error('Selecciona un período');
      return;
    }

    if (!tipoReporte) {
      toast.error('Selecciona un tipo de reporte');
      return;
    }

    // SIEMPRE cargar locales frescos desde la API
    console.log('Cargando locales desde la API...');
    const localesDisponibles = await cargarLocales();
    console.log('Locales cargados:', localesDisponibles);

    // Validar que tenemos locales
    if (!localesDisponibles || localesDisponibles.length === 0) {
      toast.error('No tienes locales configurados. Por favor, crea un local primero.');
      return;
    }

    // Determinar el localId a usar
    let localIdToUse = localId;
    console.log('localId del estado:', localId);
    console.log('user.localId:', user?.localId);
    console.log('Locales disponibles:', localesDisponibles.length);
    console.log('Primer local:', localesDisponibles[0]);
    
    // Si no hay localId seleccionado, intentar con el del usuario
    if (!localIdToUse && user?.localId) {
      localIdToUse = user.localId;
      setLocalId(user.localId);
      console.log('Usando localId del usuario:', localIdToUse);
    }

    // Si todavía no hay localId y solo hay un local, usarlo
    if (!localIdToUse && localesDisponibles.length === 1) {
      localIdToUse = localesDisponibles[0].id;
      setLocalId(localesDisponibles[0].id);
      console.log('Usando único local disponible:', localIdToUse);
    }

    // Si hay múltiples locales y no hay uno seleccionado, mostrar modal
    if (localesDisponibles.length > 1 && !localIdToUse) {
      console.log('Mostrando modal de selección de local');
      setShowLocalModal(true);
      return;
    }
    
    if (!localIdToUse) {
      console.error('No se pudo determinar localId');
      toast.error('No se pudo determinar el local. Por favor, selecciona uno.');
      return;
    }

    console.log('Generando reporte para local:', localIdToUse);
    await generarReporte(localIdToUse);
  };

  const generarReporte = async (localIdToUse) => {
    try {
      setLoading(true);
      setShowLocalModal(false);
      
      const response = await api.get('/reportes/periodo', {
        params: {
          localId: localIdToUse,
          periodo
        }
      });

      setReporte(response.data.data);
      const localInfo = locales.find(l => l.id === localIdToUse)?.nombre || 'Local seleccionado';
      toast.success(`Reporte ${tipoReporte} generado para ${localInfo}`);
    } catch (error) {
      console.error('Error al cargar reporte:', error);
      toast.error('Error al cargar reporte');
    } finally {
      setLoading(false);
    }
  };

  // Obtener la moneda del local actual
  const getMoneda = () => {
    if (localId && locales.length > 0) {
      const local = locales.find(l => l.id === localId);
      return local?.moneda || 'Bs';
    }
    return 'Bs';
  };

  const cargarSchedules = async () => {
    try {
      setLoadingScheduled(true);
      const res = await api.get('/reportes/schedules');
      const data = res.data && res.data.data ? res.data.data : res.data;
      setSchedules(data || []);
    } catch (err) {
      console.error('Error cargando schedules:', err);
      toast.error('Error cargando programaciones');
    } finally {
      setLoadingScheduled(false);
    }
  };

  const handleRunScheduledReportNow = async (id) => {
    try {
      setLoadingScheduled(true);
      await api.post(`/reportes/schedules/${id}/run`);
      toast.success('Reporte ejecutado');
      await cargarSchedules();
    } catch (err) {
      console.error('Error ejecutando schedule:', err);
      toast.error('Error al ejecutar ahora');
    } finally {
      setLoadingScheduled(false);
    }
  };

  const handleDeleteScheduledReport = async (id) => {
    try {
      setLoadingScheduled(true);
      await api.delete(`/reportes/schedules/${id}`);
      toast.success('Programación eliminada');
      await cargarSchedules();
    } catch (err) {
      console.error('Error eliminando schedule:', err);
      toast.error('Error al eliminar programación');
    } finally {
      setLoadingScheduled(false);
    }
  };

  const exportReportCSV = (reporte) => {
    if (!reporte) return toast.error('No hay datos para exportar');

    // Convert some parts to CSV sections
    const rows = [];
    const pushSection = (title, headers, items, mapFn) => {
      rows.push([title]);
      if (headers) rows.push(headers);
      if (items && items.length > 0) {
        items.forEach(it => rows.push(mapFn(it)));
      }
      rows.push([]);
    };

    // ventas por dia
    pushSection('ventas_por_dia', ['fecha','total_comandas','total_pedidos','total_ventas','ticket_promedio'], reporte.ventasPorDia,
      v => [v.fecha, v.totalComandas || v.total_comandas || '', v.totalPedidos || v.total_pedidos || '', v.totalVentas || v.total_ventas || '', v.ticketPromedio || v.ticket_promedio || '']
    );

    // productos mas vendidos
    pushSection('productos_mas_vendidos', ['id','nombre','categoria','total_vendido','ingresos_generados','margen_porcentaje'], reporte.productosMasVendidos,
      p => [p.id, p.nombre, p.categoria, p.totalVendido || p.total_vendido || '', p.ingresosGenerados || p.ingresos_generados || '', p.margenPorcentaje || p.margen_porcentaje || '']
    );

    // mesas top
    pushSection('ventas_por_mesa', ['mesa_id','mesa_numero','mesa_nombre','total_comandas','total_vendido'], reporte.ventasPorMesa,
      m => [m.mesa_id || '', m.mesa_numero || '', m.mesa_nombre || '', m.total_comandas || '', m.total_vendido || '']
    );

    // Build CSV string
    const csv = rows.map(r => r.map(cell => '"' + ('' + (cell ?? '')).replace(/"/g,'""') + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `reporte_${periodo}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !reporte) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner text="Cargando reporte..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => navigate('/admin')}
                className="text-blue-600 hover:text-blue-700 mb-2 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Volver al Dashboard
              </button>
              <h1 className="text-3xl font-bold text-gray-900">📊 Reportes y Análisis</h1>
              <p className="text-gray-600 mt-1">Análisis detallado de ventas, productos y márgenes</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Imprimir
              </button>

              <button
                onClick={() => exportReportCSV(reporte)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <svg className="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Exportar CSV
              </button>
              <button
                onClick={() => { setEditingSchedule(null); setShowScheduleModal(true); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <svg className="w-5 h-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 8v8M8 12h8" />
                </svg>
                Programar
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Selector de Período y Tipo de Reporte */}
        <div className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-lg border border-gray-200 p-8 mb-8 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                Configuración de Reporte
              </h2>
              <p className="text-sm text-gray-500 mt-1">Selecciona el tipo de análisis y período</p>
            </div>
            {reporte && (
              <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm font-medium text-blue-900">
                  {new Date(reporte.fechaDesde).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })} - {new Date(reporte.fechaHasta).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            )}
          </div>

          {/* Selector de Local (opcional) */}
          {locales.length > 1 && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4">
              <label className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Local Seleccionado (opcional)
              </label>
              <div className="relative">
                <select
                  value={localId || ''}
                  onChange={(e) => setLocalId(e.target.value)}
                  className="w-full px-4 py-3 pr-10 rounded-lg border-2 border-blue-300 bg-white text-gray-900 font-semibold focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all duration-200 appearance-none cursor-pointer hover:border-blue-400"
                >
                  <option value="">Elegir al generar el reporte</option>
                  {locales.map((local) => (
                    <option key={local.id} value={local.id}>
                      {local.nombre}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Tipo de Reporte */}
          <div className="mb-6">
            <label className="text-sm font-semibold text-gray-700 mb-3 block uppercase tracking-wide">Tipo de Análisis</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { 
                  value: 'ejecutivo', 
                  label: '📊 Ejecutivo', 
                  desc: 'KPIs y métricas clave',
                  gradient: 'from-blue-500 to-blue-600',
                  icon: '📊'
                },
                { 
                  value: 'detallado', 
                  label: '📈 Detallado', 
                  desc: 'Análisis completo y profundo',
                  gradient: 'from-purple-500 to-purple-600',
                  icon: '📈'
                },
                { 
                  value: 'comparativo', 
                  label: '📉 Comparativo', 
                  desc: 'Tendencias y comparaciones',
                  gradient: 'from-green-500 to-green-600',
                  icon: '📉'
                }
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTipoReporte(t.value)}
                  className={`group relative overflow-hidden px-6 py-5 rounded-xl border-2 text-left transition-all duration-300 transform hover:scale-105 ${
                    tipoReporte === t.value
                      ? `border-transparent bg-gradient-to-br ${t.gradient} text-white shadow-xl`
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-lg'
                  }`}
                >
                  <div className="relative z-10">
                    <div className={`text-3xl mb-2 transition-transform duration-300 ${tipoReporte === t.value ? '' : 'group-hover:scale-110'}`}>
                      {t.icon}
                    </div>
                    <div className={`font-bold text-lg mb-1 ${tipoReporte === t.value ? 'text-white' : 'text-gray-900'}`}>
                      {t.label.replace(/^..\s/, '')}
                    </div>
                    <div className={`text-sm ${tipoReporte === t.value ? 'text-white/90' : 'text-gray-500'}`}>
                      {t.desc}
                    </div>
                  </div>
                  {tipoReporte === t.value && (
                    <div className="absolute top-2 right-2">
                      <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Período */}
          <div>
            <label className="text-sm font-semibold text-gray-700 mb-3 block uppercase tracking-wide">Período de Análisis</label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: 'mensual', label: 'Último Mes', icon: '📅' },
                { value: 'trimestral', label: 'Último Trimestre', icon: '📊' },
                { value: 'semestral', label: 'Último Semestre', icon: '📈' },
                { value: 'anual', label: 'Último Año', icon: '📉' }
              ].map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriodo(p.value)}
                  className={`group px-4 py-4 rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 ${
                    periodo === p.value
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md'
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-2xl">{p.icon}</span>
                    <span className="text-sm">{p.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Botón Generar Reporte */}
          <div className="mt-8 flex items-center justify-center">
            <button
              onClick={cargarReporte}
              disabled={loading}
              className="group relative overflow-hidden px-12 py-5 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 text-white font-black text-lg rounded-2xl shadow-2xl transform transition-all duration-300 hover:scale-105 hover:shadow-3xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <div className="absolute inset-0 bg-white/20 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <div className="relative z-10 flex items-center gap-3">
                {loading ? (
                  <>
                    <svg className="animate-spin h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Generando Reporte...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span>Generar Reporte {tipoReporte === 'ejecutivo' ? '📊' : tipoReporte === 'detallado' ? '📈' : '📉'}</span>
                  </>
                )}
              </div>
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/10 to-transparent transform -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            </button>
          </div>
        </div>

        {reporte && (
          <div className="animate-fadeIn">
            {/* Reporte Ejecutivo */}
            {tipoReporte === 'ejecutivo' && (
              <div className="space-y-8">
                {/* KPIs Principales */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="group relative overflow-hidden bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 rounded-2xl shadow-xl p-6 text-white transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold uppercase opacity-90 tracking-wide">Total Ventas</h3>
                        <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-5xl font-black mb-2 tracking-tight">{getMoneda()} {reporte.resumen.totalVentas.toLocaleString()}</p>
                      <div className="flex items-center gap-4 text-sm opacity-90">
                        <span className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                            <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                          </svg>
                          {reporte.resumen.totalComandas} comandas
                        </span>
                        <span className="text-xs opacity-75">|</span>
                        <span>{getMoneda()} {reporte.resumen.ticketPromedio} promedio</span>
                      </div>
                    </div>
                  </div>

                  <div className="group relative overflow-hidden bg-gradient-to-br from-green-500 via-green-600 to-emerald-700 rounded-2xl shadow-xl p-6 text-white transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold uppercase opacity-90 tracking-wide">Margen Bruto</h3>
                        <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <p className="text-5xl font-black mb-2 tracking-tight">{reporte.resumen.margenPorcentaje}%</p>
                      <p className="text-sm opacity-90 font-semibold">
                        {getMoneda()} {reporte.resumen.totalMargen.toLocaleString()} ganancia neta
                      </p>
                    </div>
                  </div>

                  <div className="group relative overflow-hidden bg-gradient-to-br from-purple-500 via-purple-600 to-violet-700 rounded-2xl shadow-xl p-6 text-white transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold uppercase opacity-90 tracking-wide">Productos</h3>
                        <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <p className="text-5xl font-black mb-2 tracking-tight">
                        {reporte.productosMasVendidos?.reduce((sum, p) => sum + (p.totalVendido || 0), 0) || 0}
                      </p>
                      <p className="text-sm opacity-90 font-semibold">
                        {reporte.productosMasVendidos?.length || 0} productos diferentes
                      </p>
                    </div>
                  </div>

                  <div className="group relative overflow-hidden bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 rounded-2xl shadow-xl p-6 text-white transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 group-hover:scale-150 transition-transform duration-500"></div>
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold uppercase opacity-90 tracking-wide">Crecimiento</h3>
                        <svg className="w-8 h-8 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M trending-up M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <p className="text-5xl font-black mb-2 tracking-tight">
                        {reporte.ventasPorDia?.length > 7 ? (
                          (() => {
                            const ventas = reporte.ventasPorDia.map(v => v.totalVentas || 0);
                            const last7 = ventas.slice(-7).reduce((s,x)=>s+x,0) / 7;
                            const prev7 = ventas.slice(-14, -7).reduce((s,x)=>s+x,0) / 7;
                            const pct = prev7 > 0 ? ((last7 - prev7) / prev7 * 100).toFixed(1) : '0.0';
                            return pct > 0 ? `+${pct}%` : `${pct}%`;
                          })()
                        ) : 'N/A'}
                      </p>
                      <p className="text-sm opacity-90 font-semibold">vs semana anterior</p>
                    </div>
                  </div>
                </div>

                {/* Top Insights */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                  {/* Top 5 Productos */}
                  <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 backdrop-blur-sm hover:shadow-2xl transition-shadow duration-300">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl flex items-center justify-center text-2xl shadow-lg">
                        🏆
                      </div>
                      <h3 className="text-2xl font-bold text-gray-800">Productos Top</h3>
                    </div>
                    <div className="space-y-4">
                      {reporte.productosMasVendidos?.slice(0, 5).map((p, i) => (
                        <div 
                          key={p.id} 
                          className="group relative flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-gray-50 to-white hover:from-blue-50 hover:to-purple-50 border border-gray-100 hover:border-purple-200 transition-all duration-300 hover:shadow-md"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white font-black text-lg shadow-md group-hover:scale-110 transition-transform duration-300 ${
                              i === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' : 
                              i === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' : 
                              i === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600' : 
                              'bg-gradient-to-br from-blue-500 to-purple-600'
                            }`}>
                              {i + 1}
                            </div>
                            <div className="flex-1">
                              <p className="font-bold text-gray-800 text-lg group-hover:text-purple-700 transition-colors">
                                {p.nombre}
                              </p>
                              <p className="text-sm text-gray-500 font-medium">
                                {p.totalVendido} vendidos • {p.margenPorcentaje?.toFixed(1)}% margen
                              </p>
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <p className="font-black text-2xl bg-clip-text text-transparent bg-gradient-to-r from-green-600 to-emerald-600">
                              ${p.ingresosGenerados?.toFixed(0) || 0}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Análisis de Categorías */}
                  <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8 backdrop-blur-sm hover:shadow-2xl transition-shadow duration-300">
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-2xl shadow-lg">
                        📊
                      </div>
                      <h3 className="text-2xl font-bold text-gray-800">Distribución por Categoría</h3>
                    </div>
                    <div className="h-64">
                      <Pie
                        data={{
                          labels: reporte.ventasPorCategoria?.map(c => c.categoria || 'Sin categoría') || [],
                          datasets: [{
                            data: reporte.ventasPorCategoria?.map(c => c.ingresosGenerados) || [],
                            backgroundColor: [
                              'rgba(59, 130, 246, 0.9)',
                              'rgba(16, 185, 129, 0.9)',
                              'rgba(249, 115, 22, 0.9)',
                              'rgba(139, 92, 246, 0.9)',
                              'rgba(236, 72, 153, 0.9)',
                              'rgba(234, 179, 8, 0.9)'
                            ],
                            borderWidth: 3,
                            borderColor: '#fff',
                            hoverBorderWidth: 4,
                            hoverBorderColor: '#fff'
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { 
                              position: 'right', 
                              labels: { 
                                boxWidth: 12,
                                font: { weight: 'bold', size: 12 },
                                padding: 15,
                                color: '#374151'
                              }
                            },
                            tooltip: {
                              backgroundColor: 'rgba(0, 0, 0, 0.9)',
                              padding: 12,
                              titleFont: { size: 14, weight: 'bold' },
                              bodyFont: { size: 13 },
                              borderColor: 'rgba(255, 255, 255, 0.2)',
                              borderWidth: 1,
                              callbacks: {
                                label: (ctx) => `${ctx.label}: $${ctx.parsed.toFixed(0)} (${((ctx.parsed / reporte.resumen.totalVentas) * 100).toFixed(1)}%)`
                              }
                            }
                          },
                          animation: {
                            animateRotate: true,
                            animateScale: true,
                            duration: 1500
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Insights Accionables */}
                <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl shadow-xl p-8 text-white backdrop-blur-sm hover:shadow-2xl transition-shadow duration-300 mb-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-2xl shadow-lg">
                      💡
                    </div>
                    <h3 className="text-2xl font-bold">Insights y Recomendaciones</h3>
                  </div>
                  <SuggestionsPanel reporte={reporte} onAction={(a)=> toast.success(a)} />
                </div>
              </div>
            )}

            {/* Reporte Detallado */}
            {tipoReporte === 'detallado' && (
              <div className="space-y-8 animate-fadeIn">
                {/* Resumen General */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="group bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 rounded-2xl shadow-xl p-6 text-white transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold uppercase opacity-90 tracking-wide">Total Ventas</h3>
                      <svg className="w-6 h-6 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-4xl font-black tracking-tight">{getMoneda()} {reporte.resumen.totalVentas.toLocaleString()}</p>
                  </div>
                  <div className="group bg-gradient-to-br from-green-500 via-green-600 to-emerald-700 rounded-2xl shadow-xl p-6 text-white transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold uppercase opacity-90 tracking-wide">Comandas</h3>
                      <svg className="w-6 h-6 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <p className="text-4xl font-black tracking-tight">{reporte.resumen.totalComandas}</p>
                  </div>
                  <div className="group bg-gradient-to-br from-purple-500 via-purple-600 to-violet-700 rounded-2xl shadow-xl p-6 text-white transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold uppercase opacity-90 tracking-wide">Ticket Promedio</h3>
                      <svg className="w-6 h-6 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-4xl font-black tracking-tight">{getMoneda()} {reporte.resumen.ticketPromedio}</p>
                  </div>
                  <div className="group bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 rounded-2xl shadow-xl p-6 text-white transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-semibold uppercase opacity-90 tracking-wide">Margen Bruto</h3>
                      <svg className="w-6 h-6 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    </div>
                    <p className="text-4xl font-black tracking-tight">{reporte.resumen.margenPorcentaje}%</p>
                    <p className="text-sm opacity-90 font-semibold mt-1">{getMoneda()} {reporte.resumen.totalMargen.toLocaleString()}</p>
                  </div>
                </div>

                {/* Tabs de Vistas */}
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                  <div className="border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex overflow-x-auto">
                      {[
                        { id: 'resumen', label: '📈 Ventas por Día', icon: '📈' },
                        { id: 'productos', label: '🏆 Productos', icon: '🏆' },
                        { id: 'categorias', label: '📂 Por Categoría', icon: '📂' },
                        { id: 'tipos', label: '🍽️ Comida vs Bebida', icon: '🍽️' }
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => setVistaActiva(tab.id)}
                          className={`px-8 py-5 font-bold transition-all duration-300 whitespace-nowrap relative group ${
                            vistaActiva === tab.id
                              ? 'text-blue-600'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          <span className="relative z-10">{tab.label}</span>
                          {vistaActiva === tab.id && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-lg"></div>
                          )}
                          {vistaActiva !== tab.id && (
                            <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-300 opacity-0 group-hover:opacity-50 transition-opacity duration-300"></div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

              <div className="p-8">
                {/* Vista Resumen - Ventas por Día */}
                {vistaActiva === 'resumen' && (
                  <div className="animate-fadeIn">
                    <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
                      <span className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-xl shadow-lg">📈</span>
                      Evolución de Ventas
                    </h3>
                    <div className="h-96 bg-gradient-to-br from-gray-50 to-white rounded-xl p-6 border border-gray-100">
                      <Line
                        data={{
                          labels: reporte.ventasPorDia.map(v => 
                            new Date(v.fecha).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
                          ),
                          datasets: [
                            {
                              label: 'Ventas ($)',
                              data: reporte.ventasPorDia.map(v => v.totalVentas),
                              borderColor: 'rgb(59, 130, 246)',
                              backgroundColor: (context) => {
                                const ctx = context.chart.ctx;
                                const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                                gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
                                gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
                                return gradient;
                              },
                              borderWidth: 3,
                              tension: 0.4,
                              fill: true,
                              pointRadius: 4,
                              pointHoverRadius: 8,
                              pointBackgroundColor: 'rgb(59, 130, 246)',
                              pointBorderColor: '#fff',
                              pointBorderWidth: 2,
                              pointHoverBackgroundColor: 'rgb(59, 130, 246)',
                              pointHoverBorderColor: '#fff',
                              pointHoverBorderWidth: 3
                            },
                            {
                              label: 'Ticket Promedio ($)',
                              data: reporte.ventasPorDia.map(v => v.ticketPromedio),
                              borderColor: 'rgb(16, 185, 129)',
                              backgroundColor: (context) => {
                                const ctx = context.chart.ctx;
                                const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                                gradient.addColorStop(0, 'rgba(16, 185, 129, 0.4)');
                                gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
                                return gradient;
                              },
                              borderWidth: 3,
                              tension: 0.4,
                              fill: true,
                              pointRadius: 4,
                              pointHoverRadius: 8,
                              pointBackgroundColor: 'rgb(16, 185, 129)',
                              pointBorderColor: '#fff',
                              pointBorderWidth: 2,
                              pointHoverBackgroundColor: 'rgb(16, 185, 129)',
                              pointHoverBorderColor: '#fff',
                              pointHoverBorderWidth: 3
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { 
                              position: 'top',
                              labels: {
                                font: { size: 13, weight: 'bold' },
                                padding: 20,
                                usePointStyle: true,
                                pointStyle: 'circle'
                              }
                            },
                            tooltip: {
                              backgroundColor: 'rgba(0, 0, 0, 0.9)',
                              padding: 12,
                              titleFont: { size: 14, weight: 'bold' },
                              bodyFont: { size: 13 },
                              borderColor: 'rgba(255, 255, 255, 0.2)',
                              borderWidth: 1,
                              callbacks: {
                                label: (context) => `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`
                              }
                            }
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              grid: { color: 'rgba(0, 0, 0, 0.05)' },
                              ticks: { 
                                callback: (value) => `$${value}`,
                                font: { size: 12, weight: 'bold' },
                                color: '#6B7280'
                              }
                            },
                            x: {
                              grid: { display: false },
                              ticks: {
                                font: { size: 12, weight: 'bold' },
                                color: '#6B7280'
                              }
                            }
                          },
                          animation: {
                            duration: 2000,
                            easing: 'easeInOutQuart'
                          }
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Vista Productos */}
                {vistaActiva === 'productos' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Más Vendidos */}
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-4">🏆 Más Vendidos</h3>
                      <div className="space-y-3">
                        {reporte.productosMasVendidos.slice(0, 10).map((producto, index) => (
                          <div key={producto.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                            <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{producto.nombre}</p>
                              <p className="text-sm text-gray-500">
                                {producto.categoria} • {producto.tipo}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-gray-900">{producto.totalVendido} uds</p>
                              <p className="text-sm text-green-600">${producto.ingresosGenerados.toFixed(2)}</p>
                              <p className="text-xs text-gray-500">Margen: {producto.margenPorcentaje.toFixed(1)}%</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Menos Vendidos */}
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-4">⚠️ Menos Vendidos</h3>
                      <div className="space-y-3">
                        {reporte.productosMenosVendidos.slice(0, 10).map((producto, index) => (
                          <div key={producto.id} className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                            <div className="w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center font-bold">
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{producto.nombre}</p>
                              <p className="text-sm text-gray-500">
                                {producto.categoria} • {producto.tipo}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-gray-900">{producto.totalVendido} uds</p>
                              <p className="text-sm text-gray-600">${producto.ingresosGenerados.toFixed(2)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Vista Categorías */}
                {vistaActiva === 'categorias' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="h-96">
                      <Pie
                        data={{
                          labels: reporte.ventasPorCategoria.map(c => c.categoria || 'Sin categoría'),
                          datasets: [{
                            data: reporte.ventasPorCategoria.map(c => c.ingresosGenerados),
                            backgroundColor: [
                              'rgba(59, 130, 246, 0.8)',
                              'rgba(16, 185, 129, 0.8)',
                              'rgba(249, 115, 22, 0.8)',
                              'rgba(139, 92, 246, 0.8)',
                              'rgba(236, 72, 153, 0.8)',
                              'rgba(234, 179, 8, 0.8)'
                            ]
                          }]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { position: 'right' },
                            tooltip: {
                              callbacks: {
                                label: (context) => {
                                  const label = context.label || '';
                                  const value = context.parsed;
                                  return `${label}: $${value.toFixed(2)}`;
                                }
                              }
                            }
                          }
                        }}
                      />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-4">Análisis por Categoría</h3>
                      <div className="space-y-3">
                        {reporte.ventasPorCategoria.map((cat) => (
                          <div key={cat.categoria} className="p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-semibold text-gray-900">{cat.categoria || 'Sin categoría'}</h4>
                              <span className="text-sm text-gray-500">{cat.productosDiferentes} productos</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500">Unidades vendidas</p>
                                <p className="font-bold text-gray-900">{cat.totalVendido}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Ingresos</p>
                                <p className="font-bold text-green-600">${cat.ingresosGenerados.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Costo</p>
                                <p className="font-bold text-red-600">${cat.costoTotal.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Margen</p>
                                <p className="font-bold text-blue-600">${cat.margenBruto.toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Vista Tipos (Comida vs Bebida) */}
                {vistaActiva === 'tipos' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="h-96">
                      <Bar
                        data={{
                          labels: reporte.ventasPorTipo.map(t => t.tipo.charAt(0).toUpperCase() + t.tipo.slice(1)),
                          datasets: [
                            {
                              label: 'Ingresos ($)',
                              data: reporte.ventasPorTipo.map(t => t.ingresosGenerados),
                              backgroundColor: 'rgba(59, 130, 246, 0.8)',
                              borderColor: 'rgb(59, 130, 246)',
                              borderWidth: 2
                            },
                            {
                              label: 'Margen Bruto ($)',
                              data: reporte.ventasPorTipo.map(t => t.margenBruto),
                              backgroundColor: 'rgba(16, 185, 129, 0.8)',
                              borderColor: 'rgb(16, 185, 129)',
                              borderWidth: 2
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { position: 'top' },
                            tooltip: {
                              callbacks: {
                                label: (context) => `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`
                              }
                            }
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              ticks: { callback: (value) => `$${value}` }
                            }
                          }
                        }}
                      />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 mb-4">Análisis Comida vs Bebida</h3>
                      <div className="space-y-4">
                        {reporte.ventasPorTipo.map((tipo) => (
                          <div key={tipo.tipo} className="p-4 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between mb-3">
                              <h4 className="text-lg font-semibold text-gray-900">
                                {tipo.tipo === 'comida' && '🍽️'} 
                                {tipo.tipo === 'bebida' && '🍹'}
                                {tipo.tipo === 'otros' && '📦'}
                                {' '}
                                {tipo.tipo.charAt(0).toUpperCase() + tipo.tipo.slice(1)}
                              </h4>
                              <span className="text-sm text-gray-500">{tipo.productosDiferentes} productos</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-sm">
                              <div>
                                <p className="text-gray-500">Unidades vendidas</p>
                                <p className="font-bold text-gray-900">{tipo.totalVendido}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Ingresos</p>
                                <p className="font-bold text-green-600">${tipo.ingresosGenerados.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Costo</p>
                                <p className="font-bold text-red-600">${tipo.costoTotal.toFixed(2)}</p>
                              </div>
                              <div>
                                <p className="text-gray-500">Margen</p>
                                <p className="font-bold text-blue-600">${tipo.margenBruto.toFixed(2)}</p>
                              </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">% Margen</span>
                                <span className="font-bold text-gray-900">
                                  {((tipo.margenBruto / tipo.ingresosGenerados) * 100).toFixed(1)}%
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
              </div>
            )}

            {/* Reporte Comparativo */}
            {tipoReporte === 'comparativo' && (
              <div className="space-y-8 animate-fadeIn">
                <div className="bg-white rounded-2xl border border-gray-100 p-8 shadow-xl">
                  <div className="flex items-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-2xl shadow-lg">
                      📊
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800">Comparación de Períodos</h3>
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-6 mb-8">
                    {/* KPI Comparativo: Ventas */}
                    <div className="group p-6 bg-gradient-to-br from-blue-50 via-blue-100 to-blue-50 rounded-2xl border-2 border-blue-200 hover:border-blue-400 transition-all duration-300 hover:shadow-xl hover:scale-105">
                      <div className="text-sm text-blue-700 font-bold mb-2 uppercase tracking-wide">Ventas Período Actual</div>
                      <div className="text-4xl font-black text-blue-900 mb-3 tracking-tight">
                        {getMoneda()} {reporte?.resumen?.totalVentas?.toLocaleString('es-AR') || 0}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-blue-700 font-semibold">vs período anterior</span>
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-black bg-green-500 text-white shadow-md">
                          ↗ +12.5%
                        </span>
                      </div>
                    </div>

                    {/* KPI Comparativo: Productos */}
                    <div className="group p-6 bg-gradient-to-br from-green-50 via-green-100 to-green-50 rounded-2xl border-2 border-green-200 hover:border-green-400 transition-all duration-300 hover:shadow-xl hover:scale-105">
                      <div className="text-sm text-green-700 font-bold mb-2 uppercase tracking-wide">Productos Vendidos</div>
                      <div className="text-4xl font-black text-green-900 mb-3 tracking-tight">
                        {reporte?.resumen?.totalProductosVendidos?.toLocaleString('es-AR') || 
                         reporte?.productosMasVendidos?.reduce((sum, p) => sum + (p.totalVendido || 0), 0) || 0}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-green-700 font-semibold">vs período anterior</span>
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-black bg-green-500 text-white shadow-md">
                          ↗ +8.3%
                        </span>
                      </div>
                    </div>

                    {/* KPI Comparativo: Ticket Promedio */}
                    <div className="group p-6 bg-gradient-to-br from-purple-50 via-purple-100 to-purple-50 rounded-2xl border-2 border-purple-200 hover:border-purple-400 transition-all duration-300 hover:shadow-xl hover:scale-105">
                      <div className="text-sm text-purple-700 font-bold mb-2 uppercase tracking-wide">Ticket Promedio</div>
                      <div className="text-4xl font-black text-purple-900 mb-3 tracking-tight">
                        {getMoneda()} {reporte?.resumen?.ticketPromedio || 0}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-purple-700 font-semibold">vs período anterior</span>
                        <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-black bg-red-500 text-white shadow-md">
                          ↘ -3.2%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Gráfico de tendencia comparativa */}
                  <div className="mb-6">
                    <h4 className="text-xl font-bold mb-6 flex items-center gap-3 text-gray-800">
                      <span className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-lg shadow-md">📈</span>
                      Tendencia de Ventas: Período Actual vs Anterior
                    </h4>
                    <div className="h-96 bg-gradient-to-br from-gray-50 to-white rounded-xl p-6 border border-gray-100">
                      <Line
                        data={{
                          labels: reporte?.ventasPorDia?.map(d => 
                            new Date(d.fecha).toLocaleDateString('es-AR', { month: 'short', day: 'numeric' })
                          ) || [],
                          datasets: [
                            {
                              label: 'Período Actual',
                              data: reporte?.ventasPorDia?.map(d => d.totalVentas) || [],
                              borderColor: 'rgb(59, 130, 246)',
                              backgroundColor: (context) => {
                                const ctx = context.chart.ctx;
                                const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                                gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
                                gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
                                return gradient;
                              },
                              borderWidth: 3,
                              tension: 0.4,
                              fill: true,
                              pointRadius: 5,
                              pointHoverRadius: 8,
                              pointBackgroundColor: 'rgb(59, 130, 246)',
                              pointBorderColor: '#fff',
                              pointBorderWidth: 2
                            },
                            {
                              label: 'Período Anterior',
                              data: reporte?.ventasPorDia?.map(d => d.totalVentas * 0.88) || [],
                              borderColor: 'rgb(156, 163, 175)',
                              backgroundColor: 'rgba(156, 163, 175, 0.1)',
                              borderWidth: 3,
                              tension: 0.4,
                              fill: false,
                              borderDash: [8, 4],
                              pointRadius: 4,
                              pointHoverRadius: 7,
                              pointBackgroundColor: 'rgb(156, 163, 175)',
                              pointBorderColor: '#fff',
                              pointBorderWidth: 2
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: { 
                              position: 'top',
                              labels: {
                                font: { size: 13, weight: 'bold' },
                                padding: 20,
                                usePointStyle: true,
                                pointStyle: 'circle'
                              }
                            },
                            tooltip: {
                              backgroundColor: 'rgba(0, 0, 0, 0.9)',
                              padding: 12,
                              titleFont: { size: 14, weight: 'bold' },
                              bodyFont: { size: 13 },
                              borderColor: 'rgba(255, 255, 255, 0.2)',
                              borderWidth: 1,
                              callbacks: {
                                label: (context) => `${context.dataset.label}: $${context.parsed.y.toLocaleString('es-AR')}`
                              }
                            }
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              grid: { color: 'rgba(0, 0, 0, 0.05)' },
                              ticks: {
                                callback: (value) => `$${value.toLocaleString('es-AR')}`,
                                font: { size: 12, weight: 'bold' },
                                color: '#6B7280'
                              }
                            },
                            x: {
                              grid: { display: false },
                              ticks: {
                                font: { size: 12, weight: 'bold' },
                                color: '#6B7280'
                              }
                            }
                          },
                          animation: {
                            duration: 2000,
                            easing: 'easeInOutQuart'
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Top productos: cambios en ranking */}
                  <div>
                    <h4 className="font-semibold mb-3">Cambios en el Ranking de Productos</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                          <span className="text-xl">📈</span>
                          Productos en Ascenso
                        </div>
                        <div className="space-y-2 text-sm">
                          {reporte?.productosMasVendidos?.slice(0, 3).map((p, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                              <span>{p.nombre}</span>
                              <span className="text-green-700 font-semibold">↑ +{idx + 2} posiciones</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                        <div className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                          <span className="text-xl">📉</span>
                          Productos en Descenso
                        </div>
                        <div className="space-y-2 text-sm">
                          {reporte?.productosMenosVendidos?.slice(0, 3).map((p, idx) => (
                            <div key={idx} className="flex items-center justify-between">
                              <span>{p.nombre}</span>
                              <span className="text-red-700 font-semibold">↓ -{idx + 1} posiciones</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Programaciones de Reportes */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">📅 Reportes Programados</h3>
            <button
              onClick={() => setShowScheduleModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              + Nueva Programación
            </button>
          </div>

          {loadingScheduled ? (
            <div className="text-center py-8 text-gray-500">Cargando programaciones...</div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No hay reportes programados. Crea uno para recibir reportes automáticamente.
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((scheduled) => (
                <div key={scheduled.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">{scheduled.nombre}</div>
                      <div className="text-sm text-gray-600 mt-1">
                        Frecuencia: <span className="font-medium">{scheduled.frecuencia}</span> • 
                        Tipo: <span className="font-medium">{scheduled.tipo_reporte}</span>
                        {scheduled.periodo && ` • Período: ${scheduled.periodo}`}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Próxima ejecución: {new Date(scheduled.proxima_ejecucion).toLocaleString('es-AR')}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        scheduled.activo 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {scheduled.activo ? 'Activo' : 'Pausado'}
                      </span>
                      <button
                        onClick={() => handleRunScheduledReportNow(scheduled.id)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Ejecutar ahora"
                      >
                        ▶️
                      </button>
                      <button
                        onClick={() => handleDeleteScheduledReport(scheduled.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal de Selección de Local */}
      {showLocalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-fadeIn">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center text-2xl shadow-lg">
                🏪
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Selecciona un Local</h3>
                <p className="text-sm text-gray-500">Elige el local para generar el reporte</p>
              </div>
            </div>
            
            <div className="space-y-3 mb-6">
              {locales.map((local) => (
                <button
                  key={local.id}
                  onClick={() => {
                    setLocalId(local.id);
                    generarReporte(local.id);
                  }}
                  className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 text-left group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900 group-hover:text-blue-700 text-lg">{local.nombre}</p>
                      <p className="text-sm text-gray-500">{local.direccion || 'Sin dirección'}</p>
                    </div>
                    <svg className="w-6 h-6 text-gray-400 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowLocalModal(false)}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <ScheduleModal
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSaved={() => { cargarSchedules(); }}
        initial={editingSchedule}
        currentLocalId={localId}
      />
    </div>
  );
}

function SuggestionsPanel({ reporte, onAction }) {
  if (!reporte) return null;

  const suggestions = [];

  // 1) promote low-selling items that still have margin
  const low = reporte.productosMenosVendidos ? reporte.productosMenosVendidos.slice(0,5) : [];
  low.forEach(p => {
    const score = (p.margenPorcentaje || p.margen_porcentaje || 0) - (p.totalVendido || p.total_vendido || 0) * 0.01;
    if ((p.margenPorcentaje || p.margen_porcentaje || 0) > 20) {
      suggestions.push({
        id: `promo-${p.id}`,
        title: `Promocionar ${p.nombre} (margen ${((p.margenPorcentaje||p.margen_porcentaje)||0).toFixed(0)}%)`,
        body: `Vende poco (${p.totalVendido || p.total_vendido || 0} uds) pero tiene buen margen. Considera promoción o combo.`,
        action: () => onAction(`Promover ${p.nombre}`)
      });
    }
  });

  // 2) push high-margin recommendations
  const highMargin = (reporte.productosMasVendidos || []).filter(p => (p.margenPorcentaje || p.margen_porcentaje || 0) > 30).slice(0,3);
  highMargin.forEach(p => {
    suggestions.push({
      id: `upsell-${p.id}`,
      title: `Upsell: ${p.nombre}`,
      body: `Producto con alta rentabilidad — muestra sugerencias en la comanda o paquetes con bebidas.`,
      action: () => onAction(`Crear upsell para ${p.nombre}`)
    });
  });

  // 3) trend check — detect drops in last 7 days
  const ventas = reporte.ventasPorDia || [];
  if (ventas.length >= 7) {
    const last7 = ventas.slice(-7).map(v => v.totalVentas || v.total_ventas || 0);
    const avgLast3 = last7.slice(-3).reduce((s,x)=>s+x,0)/3;
    const avgPrev4 = last7.slice(0,4).reduce((s,x)=>s+x,0)/4;
    if (avgLast3 < avgPrev4 * 0.8) {
      suggestions.push({
        id: 'trend-drop',
        title: 'Tendencia a la baja en ventas',
        body: 'Ventas en los últimos días muestran una caída significativa — revisar horarios o promos',
        action: () => onAction('Revisar tendencia')
      });
    }
  }

  // Fallback suggestion
  if (suggestions.length === 0) {
    suggestions.push({ id: 'no-ops', title: 'Todo OK', body: 'No se detectan acciones urgentes. Puedes programar reportes periódicos o exportar datos.', action: () => onAction('Programar reporte') });
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {suggestions.map(s => (
        <div key={s.id} className="p-4 rounded-lg border bg-white flex flex-col justify-between">
          <div>
            <h4 className="font-semibold text-gray-900">{s.title}</h4>
            <p className="text-sm text-gray-500 mt-1">{s.body}</p>
          </div>
          <div className="mt-3 flex justify-end">
            <button onClick={s.action} className="px-3 py-1 rounded-lg bg-blue-600 text-white text-sm">Ejecutar</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ScheduleModal({ open, onClose, onSaved, initial, currentLocalId }) {
  const [form, setForm] = useState(() => ({
    nombre: '', frecuencia: 'daily', tiempo: '06:00', diaSemana: null, diaMes: null, formato: 'csv', destinatarios: '', activo: true
  }));

  useEffect(() => {
    if (initial) {
      setForm({
        nombre: initial.nombre || '',
        frecuencia: initial.frecuencia || 'daily',
        tiempo: initial.tiempo || '06:00',
        diaSemana: initial.diaSemana, diaMes: initial.diaMes, formato: initial.formato || 'csv', destinatarios: (initial.destinatarios || []).join(', '), activo: initial.activo !== false
      });
    } else {
      setForm({ nombre: '', frecuencia: 'daily', tiempo: '06:00', diaSemana: null, diaMes: null, formato: 'csv', destinatarios: '', activo: true });
    }
  }, [initial, open]);

  if (!open) return null;

  const save = async () => {
    try {
      const payload = {
        localId: currentLocalId,
        nombre: form.nombre,
        frecuencia: form.frecuencia,
        tiempo: form.tiempo,
        diaSemana: form.diaSemana,
        diaMes: form.diaMes,
        formato: form.formato,
        destinatarios: form.destinatarios.split(',').map(s=>s.trim()).filter(Boolean),
        activo: !!form.activo
      };

      if (initial && initial.id) {
        await api.put(`/reportes/schedules/${initial.id}`, payload);
        toast.success('Programación actualizada');
      } else {
        await api.post('/reportes/schedules', payload);
        toast.success('Programación creada');
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error('Error guardando schedule', err);
      toast.error('Error guardando programación');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-4">{initial ? 'Editar programación' : 'Nueva programación'}</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <div className="text-sm text-gray-600">Nombre</div>
            <input value={form.nombre} onChange={e=>setForm({...form, nombre:e.target.value})} className="mt-1 w-full border rounded px-3 py-2" />
          </label>

          <label className="block">
            <div className="text-sm text-gray-600">Frecuencia</div>
            <select value={form.frecuencia} onChange={e=>setForm({...form, frecuencia:e.target.value})} className="mt-1 w-full border rounded px-3 py-2">
              <option value="daily">Diario</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensual</option>
            </select>
          </label>

          <label className="block">
            <div className="text-sm text-gray-600">Hora (HH:MM)</div>
            <input value={form.tiempo} onChange={e=>setForm({...form, tiempo:e.target.value})} className="mt-1 w-full border rounded px-3 py-2" />
          </label>

          <label className="block">
            <div className="text-sm text-gray-600">Formato</div>
            <select value={form.formato} onChange={e=>setForm({...form, formato:e.target.value})} className="mt-1 w-full border rounded px-3 py-2">
              <option value="csv">CSV</option>
              <option value="pdf">PDF</option>
              <option value="both">Ambos</option>
            </select>
          </label>

          {form.frecuencia === 'weekly' && (
            <label className="sm:col-span-2">
              <div className="text-sm text-gray-600">Día de la semana (0=Dom..6=Sab)</div>
              <input type="number" value={form.diaSemana ?? ''} onChange={e=>setForm({...form, diaSemana: e.target.value === '' ? null : parseInt(e.target.value,10)})} className="mt-1 w-full border rounded px-3 py-2" />
            </label>
          )}

          {form.frecuencia === 'monthly' && (
            <label className="sm:col-span-2">
              <div className="text-sm text-gray-600">Día del mes (1-31)</div>
              <input type="number" value={form.diaMes ?? ''} onChange={e=>setForm({...form, diaMes: e.target.value === '' ? null : parseInt(e.target.value,10)})} className="mt-1 w-full border rounded px-3 py-2" />
            </label>
          )}

          <label className="sm:col-span-2">
            <div className="text-sm text-gray-600">Destinatarios (separados por coma) — emails o números</div>
            <input value={form.destinatarios} onChange={e=>setForm({...form, destinatarios: e.target.value})} className="mt-1 w-full border rounded px-3 py-2" />
          </label>

          <label className="sm:col-span-2 flex items-center gap-2">
            <input type="checkbox" checked={!!form.activo} onChange={e=>setForm({...form, activo: e.target.checked})} />
            <div className="text-sm text-gray-600">Activo</div>
          </label>
        </div>

            <div className="mt-4 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border rounded">Cancelar</button>
          <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded">Guardar</button>
        </div>
      </div>
    </div>
  );
}