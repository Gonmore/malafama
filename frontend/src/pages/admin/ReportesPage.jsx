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

export default function ReportesPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [periodo, setPeriodo] = useState('mensual');
  const [reporte, setReporte] = useState(null);
  const [vistaActiva, setVistaActiva] = useState('resumen'); // resumen, productos, categorias, tipos
  const [localId, setLocalId] = useState(null);

  useEffect(() => {
    cargarLocalId();
  }, []);

  useEffect(() => {
    if (localId) {
      cargarReporte();
    }
  }, [periodo, localId]);

  const cargarLocalId = async () => {
    try {
      const response = await localService.obtenerLocales();
      if (response.data && response.data.length > 0) {
        setLocalId(response.data[0].id);
      }
    } catch (error) {
      console.error('Error al cargar local:', error);
      toast.error('Error al cargar configuración');
    }
  };

  const cargarReporte = async () => {
    try {
      setLoading(true);
      
      const response = await api.get('/reportes/periodo', {
        params: {
          localId,
          periodo
        }
      });

      setReporte(response.data.data);
    } catch (error) {
      console.error('Error al cargar reporte:', error);
      toast.error('Error al cargar reporte');
    } finally {
      setLoading(false);
    }
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
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Selector de Período */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Período de Análisis</h2>
          <div className="flex gap-3">
            {[
              { value: 'mensual', label: 'Último Mes' },
              { value: 'trimestral', label: 'Último Trimestre' },
              { value: 'semestral', label: 'Último Semestre' },
              { value: 'anual', label: 'Último Año' }
            ].map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriodo(p.value)}
                className={`px-6 py-3 rounded-lg font-medium transition-all ${
                  periodo === p.value
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {reporte && (
            <p className="text-sm text-gray-500 mt-3">
              📅 Del {new Date(reporte.fechaDesde).toLocaleDateString('es-ES')} al{' '}
              {new Date(reporte.fechaHasta).toLocaleDateString('es-ES')}
            </p>
          )}
        </div>

        {reporte && (
          <>
            {/* Resumen General */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-sm p-6 text-white">
                <h3 className="text-sm font-semibold uppercase opacity-90 mb-2">Total Ventas</h3>
                <p className="text-4xl font-bold">${reporte.resumen.totalVentas.toLocaleString()}</p>
              </div>
              <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg shadow-sm p-6 text-white">
                <h3 className="text-sm font-semibold uppercase opacity-90 mb-2">Comandas</h3>
                <p className="text-4xl font-bold">{reporte.resumen.totalComandas}</p>
              </div>
              <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg shadow-sm p-6 text-white">
                <h3 className="text-sm font-semibold uppercase opacity-90 mb-2">Ticket Promedio</h3>
                <p className="text-4xl font-bold">${reporte.resumen.ticketPromedio}</p>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg shadow-sm p-6 text-white">
                <h3 className="text-sm font-semibold uppercase opacity-90 mb-2">Margen Bruto</h3>
                <p className="text-4xl font-bold">{reporte.resumen.margenPorcentaje}%</p>
                <p className="text-sm opacity-90">${reporte.resumen.totalMargen.toLocaleString()}</p>
              </div>
            </div>

            {/* Tabs de Vistas */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
              <div className="border-b border-gray-200">
                <div className="flex">
                  {[
                    { id: 'resumen', label: '📈 Ventas por Día', icon: '📈' },
                    { id: 'productos', label: '🏆 Productos', icon: '🏆' },
                    { id: 'categorias', label: '📂 Por Categoría', icon: '📂' },
                    { id: 'tipos', label: '🍽️ Comida vs Bebida', icon: '🍽️' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setVistaActiva(tab.id)}
                      className={`px-6 py-4 font-medium transition-colors ${
                        vistaActiva === tab.id
                          ? 'border-b-2 border-blue-600 text-blue-600'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-6">
                {/* Vista Resumen - Ventas por Día */}
                {vistaActiva === 'resumen' && (
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-4">Evolución de Ventas</h3>
                    <div className="h-96">
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
                              backgroundColor: 'rgba(59, 130, 246, 0.1)',
                              tension: 0.4,
                              fill: true
                            },
                            {
                              label: 'Ticket Promedio ($)',
                              data: reporte.ventasPorDia.map(v => v.ticketPromedio),
                              borderColor: 'rgb(16, 185, 129)',
                              backgroundColor: 'rgba(16, 185, 129, 0.1)',
                              tension: 0.4,
                              fill: true
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
          </>
        )}
      </main>
    </div>
  );
}
