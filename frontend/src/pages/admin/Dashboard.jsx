import { useState, useEffect } from 'react';
import { reporteService } from '../../services/reporteService';
import { mesaService } from '../../services/mesaService';
import { productoService } from '../../services/productoService';
import LoadingSpinner from '../../components/LoadingSpinner';
import Alert from '../../components/Alert';
import toast from 'react-hot-toast';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState(null);
  const [ocupacion, setOcupacion] = useState(null);
  const [productos, setProductos] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Cargar datos en paralelo
      const [dashboardData, ocupacionData, productosData] = await Promise.all([
        reporteService.getDashboard(),
        mesaService.getOcupacion(),
        productoService.getAll({ disponible: true })
      ]);

      setDashboard(dashboardData.data);
      setOcupacion(ocupacionData.data);
      setProductos(productosData.data);
    } catch (error) {
      console.error('Error cargando dashboard:', error);
      setError(error.response?.data?.message || 'Error al cargar datos del dashboard');
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Cargando dashboard..." />;
  }

  if (error) {
    return (
      <Alert 
        type="error" 
        message={error}
        onClose={() => setError(null)}
      />
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-900">Panel de Administración</h2>
        <button 
          onClick={loadDashboardData}
          className="btn-secondary"
        >
          Actualizar
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard 
          title="Total Ventas Hoy" 
          value={`$${parseFloat(dashboard?.ventasHoy?.total_ventas || 0).toFixed(2)}`}
          color="green" 
        />
        <StatCard 
          title="Comandas Abiertas" 
          value={dashboard?.comandasAbiertas || 0}
          color="blue" 
        />
        <StatCard 
          title="Productos Activos" 
          value={productos.length}
          color="purple" 
        />
        <StatCard 
          title="Mesas Ocupadas" 
          value={`${ocupacion?.mesasOcupadas || 0}/${ocupacion?.totalMesas || 0}`}
          color="orange" 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">Estadísticas del Día</h3>
          <div className="space-y-3">
            <div className="flex justify-between p-3 bg-gray-50 rounded">
              <span className="text-gray-600">Comandas del día:</span>
              <span className="font-semibold">{dashboard?.ventasHoy?.total_comandas || 0}</span>
            </div>
            <div className="flex justify-between p-3 bg-gray-50 rounded">
              <span className="text-gray-600">Pedidos del día:</span>
              <span className="font-semibold">{dashboard?.ventasHoy?.total_pedidos || 0}</span>
            </div>
            <div className="flex justify-between p-3 bg-gray-50 rounded">
              <span className="text-gray-600">Ticket promedio:</span>
              <span className="font-semibold">
                ${dashboard?.ventasHoy?.total_comandas > 0 
                  ? (dashboard.ventasHoy.total_ventas / dashboard.ventasHoy.total_comandas).toFixed(2)
                  : '0.00'}
              </span>
            </div>
            <div className="flex justify-between p-3 bg-red-50 rounded">
              <span className="text-gray-600">Pagos pendientes:</span>
              <span className="font-semibold text-red-600">
                ${parseFloat(dashboard?.pagosPendientes || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-xl font-semibold mb-4">Top Productos del Mes</h3>
          {dashboard?.topProductos && dashboard.topProductos.length > 0 ? (
            <div className="space-y-2">
              {dashboard.topProductos.map((producto, index) => (
                <ProductItem 
                  key={index}
                  name={producto.producto_nombre}
                  sales={producto.total_vendido}
                  revenue={producto.ingresos_generados}
                />
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No hay datos disponibles</p>
          )}
        </div>
      </div>

      {ocupacion && (
        <div className="card mt-6">
          <h3 className="text-xl font-semibold mb-4">Estado de Mesas</h3>
          <div className="flex items-center space-x-4">
            <div className="flex-1 bg-gray-200 rounded-full h-4">
              <div 
                className="bg-orange-500 h-4 rounded-full transition-all duration-300"
                style={{ width: `${ocupacion.porcentajeOcupacion}%` }}
              />
            </div>
            <span className="font-semibold text-lg">{ocupacion.porcentajeOcupacion}%</span>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold">{ocupacion.totalMesas}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Ocupadas</p>
              <p className="text-2xl font-bold text-orange-600">{ocupacion.mesasOcupadas}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Disponibles</p>
              <p className="text-2xl font-bold text-green-600">{ocupacion.mesasDisponibles}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, color }) {
  const colorClasses = {
    green: 'bg-green-100 text-green-800',
    blue: 'bg-blue-100 text-blue-800',
    purple: 'bg-purple-100 text-purple-800',
    orange: 'bg-orange-100 text-orange-800'
  }

  return (
    <div className="card">
      <p className="text-sm text-gray-600 mb-2">{title}</p>
      <p className={`text-3xl font-bold ${colorClasses[color]}`}>{value}</p>
    </div>
  )
}

function ProductItem({ name, sales, revenue }) {
  return (
    <div className="flex justify-between items-center py-2 border-b">
      <div>
        <span className="text-gray-700 font-medium">{name}</span>
        <p className="text-sm text-gray-500">${parseFloat(revenue).toFixed(2)} generados</p>
      </div>
      <span className="font-semibold text-primary-600">{sales} vendidos</span>
    </div>
  );
}
