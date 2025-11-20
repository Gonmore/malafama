export default function ProveedorDashboard() {
  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-900 mb-6">Panel de Proveedor</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Ventas del Mes" value="$2,450.00" color="green" />
        <StatCard title="Productos Activos" value="12" color="blue" />
        <StatCard title="Pago Pendiente" value="$1,200.00" color="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-xl font-semibold mb-4">Mis Productos</h3>
          <div className="space-y-3">
            <ProductoProveedor nombre="Tomate" ventas="150 kg" monto="$450.00" />
            <ProductoProveedor nombre="Lechuga" ventas="80 kg" monto="$240.00" />
            <ProductoProveedor nombre="Cebolla" ventas="100 kg" monto="$180.00" />
          </div>
        </div>

        <div className="card">
          <h3 className="text-xl font-semibold mb-4">Historial de Pagos</h3>
          <div className="space-y-3">
            <PagoItem fecha="01/11/2025" monto="$1,500.00" estado="Pagado" />
            <PagoItem fecha="01/10/2025" monto="$1,350.00" estado="Pagado" />
            <PagoItem fecha="Período actual" monto="$1,200.00" estado="Pendiente" />
          </div>
        </div>
      </div>

      <div className="card mt-6">
        <h3 className="text-xl font-semibold mb-4">Ventas por Período</h3>
        <div className="flex gap-4 mb-4">
          <button className="btn-primary">Diario</button>
          <button className="btn-secondary">Semanal</button>
          <button className="btn-secondary">Mensual</button>
        </div>
        <div className="text-center py-8 text-gray-500">
          Gráfica de ventas (por implementar)
        </div>
      </div>
    </div>
  )
}

function StatCard({ title, value, color }) {
  const colorClasses = {
    green: 'text-green-600',
    blue: 'text-blue-600',
    orange: 'text-orange-600'
  }

  return (
    <div className="card">
      <p className="text-sm text-gray-600 mb-2">{title}</p>
      <p className={`text-3xl font-bold ${colorClasses[color]}`}>{value}</p>
    </div>
  )
}

function ProductoProveedor({ nombre, ventas, monto }) {
  return (
    <div className="flex justify-between items-center py-3 border-b">
      <div>
        <p className="font-medium text-gray-900">{nombre}</p>
        <p className="text-sm text-gray-600">{ventas}</p>
      </div>
      <span className="font-semibold text-primary-600">{monto}</span>
    </div>
  )
}

function PagoItem({ fecha, monto, estado }) {
  return (
    <div className="flex justify-between items-center py-3 border-b">
      <div>
        <p className="font-medium text-gray-900">{fecha}</p>
        <p className="text-sm text-gray-600">{monto}</p>
      </div>
      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
        estado === 'Pagado' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
      }`}>
        {estado}
      </span>
    </div>
  )
}
