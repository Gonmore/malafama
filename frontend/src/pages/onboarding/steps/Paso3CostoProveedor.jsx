import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../../store/authStore';
import proveedorService from '../../../services/proveedorService';

export default function Paso3CostoProveedor({ 
  productos, 
  productosScrapeados,
  proveedores, 
  moneda = 'Bs',
  onCompletar, 
  onRetroceder 
}) {
  const { user } = useAuthStore();
  const [productosConCosto, setProductosConCosto] = useState([]);
  const [nuevoProveedor, setNuevoProveedor] = useState({ nombre: '', email: '', telefono: '' });
  const [mostrarFormProveedor, setMostrarFormProveedor] = useState(false);
  const [proveedoresDisponibles, setProveedoresDisponibles] = useState([]);
  const [cargandoProveedores, setCargandoProveedores] = useState(true);

  useEffect(() => {
    // Cargar proveedores del local del usuario autenticado
    cargarProveedores();
  }, []);

  useEffect(() => {
    // Inicializar productos con campos de costo, proveedor y tipo detectado automáticamente
    const productosIniciales = productos.map(p => {
      // Detectar tipo basándose en categoría
      let tipoDetectado = 'otros';
      const categoria = (p.categoria || '').toLowerCase();
      
      if (categoria.includes('bebida') || categoria.includes('trago') || 
          categoria.includes('cerveza') || categoria.includes('vino') || 
          categoria.includes('coctel') || categoria.includes('cocktail')) {
        tipoDetectado = 'bebida';
      } else if (categoria.includes('comida') || categoria.includes('pizza') || 
                 categoria.includes('hamburguesa') || categoria.includes('entrada') ||
                 categoria.includes('plato') || categoria.includes('picoteo') ||
                 categoria.includes('menú')) {
        tipoDetectado = 'comida';
      }
      
      return {
        ...p,
        costo: '',
        proveedorId: proveedoresDisponibles.length > 0 ? proveedoresDisponibles[0].id : '',
        margen: 0,
        tipo: tipoDetectado
      };
    });
    setProductosConCosto(productosIniciales);
  }, [productos, proveedoresDisponibles]);

  const cargarProveedores = async () => {
    try {
      setCargandoProveedores(true);
      const response = await proveedorService.getAll();
      const proveedoresCargados = response.data.proveedores || response.data || [];
      setProveedoresDisponibles(proveedoresCargados);
    } catch (error) {
      console.error('Error al cargar proveedores:', error);
      toast.error('Error al cargar proveedores');
      setProveedoresDisponibles([]);
    } finally {
      setCargandoProveedores(false);
    }
  };

  const calcularMargen = (precio, costo) => {
    if (!precio || !costo || costo === 0) return 0;
    const margen = ((precio - costo) / costo) * 100;
    return margen.toFixed(1);
  };

  const handleCambioCosto = (index, costo) => {
    const nuevosProductos = [...productosConCosto];
    nuevosProductos[index].costo = costo;
    nuevosProductos[index].margen = calcularMargen(nuevosProductos[index].precio, costo);
    setProductosConCosto(nuevosProductos);
  };

  const handleCambioProveedor = (index, proveedorId) => {
    const nuevosProductos = [...productosConCosto];
    nuevosProductos[index].proveedorId = proveedorId;
    setProductosConCosto(nuevosProductos);
  };

  const handleCambioTipo = (index, tipo) => {
    const nuevosProductos = [...productosConCosto];
    nuevosProductos[index].tipo = tipo;
    setProductosConCosto(nuevosProductos);
  };

  const handleCrearProveedor = async (e) => {
    e.preventDefault();
    
    try {
      const response = await proveedorService.create(nuevoProveedor);
      const proveedorCreado = response.data.proveedor;
      
      setProveedoresDisponibles([...proveedoresDisponibles, proveedorCreado]);
      toast.success('✅ Proveedor creado');
      
      setNuevoProveedor({ nombre: '', email: '', telefono: '' });
      setMostrarFormProveedor(false);
    } catch (error) {
      console.error('Error al crear proveedor:', error);
      const mensaje = error.response?.data?.message || 'Error al crear proveedor';
      toast.error(mensaje);
    }
  };

  const handleContinuar = () => {
    // Validar que todos los productos tengan costo y proveedor
    const productosValidos = productosConCosto.every(p => 
      p.costo && parseFloat(p.costo) >= 0 && p.proveedorId
    );

    if (!productosValidos) {
      toast.error('Todos los productos deben tener costo y proveedor asignado');
      return;
    }

    // Formatear productos
    const productosFormateados = productosConCosto.map(p => ({
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      categoria: p.categoria || 'Otros',
      tipo: p.tipo || 'otros',
      precio: parseFloat(p.precio),
      costo: parseFloat(p.costo),
      proveedorId: p.proveedorId,
      disponible: true,
      activo: true
    }));

    onCompletar(productosFormateados);
  };

  const aplicarCostoMasivo = () => {
    const porcentaje = prompt('¿Qué porcentaje del precio será el costo? (Ej: 40 para 40%)');
    if (!porcentaje || isNaN(porcentaje)) return;

    const factor = parseFloat(porcentaje) / 100;
    const nuevosProductos = productosConCosto.map(p => ({
      ...p,
      costo: (parseFloat(p.precio) * factor).toFixed(2),
      margen: calcularMargen(p.precio, parseFloat(p.precio) * factor)
    }));
    
    setProductosConCosto(nuevosProductos);
    toast.success(`✅ Costo aplicado (${porcentaje}% del precio)`);
  };

  const aplicarProveedorMasivo = () => {
    if (proveedoresDisponibles.length === 0) {
      toast.error('Primero crea un proveedor');
      return;
    }

    const proveedorId = proveedoresDisponibles[0].id;
    const nuevosProductos = productosConCosto.map(p => ({
      ...p,
      proveedorId: proveedorId
    }));
    
    setProductosConCosto(nuevosProductos);
    toast.success('✅ Proveedor aplicado a todos los productos');
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        Paso 3: Asignar Costos y Proveedores
      </h2>
      <p className="text-gray-600 mb-6">
        Define el costo y proveedor de cada producto para calcular márgenes de ganancia
      </p>

      {/* Gestión de proveedores */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-blue-900">👥 Proveedores</h3>
          <button
            type="button"
            onClick={() => setMostrarFormProveedor(!mostrarFormProveedor)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {mostrarFormProveedor ? '✕ Cancelar' : '+ Agregar proveedor'}
          </button>
        </div>

        {cargandoProveedores ? (
          <p className="text-sm text-blue-700">Cargando proveedores...</p>
        ) : proveedoresDisponibles.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-3">
            {proveedoresDisponibles.map(proveedor => (
              <span
                key={proveedor.id}
                className="px-3 py-1 bg-white rounded-full text-sm text-gray-700 border border-blue-200"
              >
                {proveedor.nombre}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-blue-700 mb-3">
            No hay proveedores. Crea uno para continuar.
          </p>
        )}

        {mostrarFormProveedor && (
          <form onSubmit={handleCrearProveedor} className="bg-white rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={nuevoProveedor.nombre}
                  onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, nombre: e.target.value })}
                  placeholder="Distribuidora XYZ"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={nuevoProveedor.email}
                  onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, email: e.target.value })}
                  placeholder="contacto@proveedor.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <input
                type="tel"
                value={nuevoProveedor.telefono}
                onChange={(e) => setNuevoProveedor({ ...nuevoProveedor, telefono: e.target.value })}
                placeholder="+1 234 567 890"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Crear Proveedor
            </button>
          </form>
        )}
      </div>

      {/* Acciones masivas */}
      {productosConCosto.length > 1 && proveedoresDisponibles.length > 0 && (
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={aplicarCostoMasivo}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            ⚡ Aplicar costo masivo
          </button>
          <button
            type="button"
            onClick={aplicarProveedorMasivo}
            className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            ⚡ Aplicar proveedor masivo
          </button>
        </div>
      )}

      {/* Lista de productos */}
      <div className="space-y-3 mb-6 max-h-96 overflow-y-auto">
        {productosConCosto.map((producto, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-semibold text-gray-900">{producto.nombre}</h4>
                <p className="text-sm text-gray-500">
                  {producto.categoria} • Precio venta: {moneda}{parseFloat(producto.precio).toFixed(2)}
                </p>
              </div>
              {producto.margen > 0 && (
                <span className={`px-2 py-1 rounded text-sm font-medium ${
                  producto.margen >= 100 ? 'bg-green-100 text-green-800' :
                  producto.margen >= 50 ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  Margen: {producto.margen}%
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Costo del producto * ({moneda})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={producto.costo}
                  onChange={(e) => handleCambioCosto(index, e.target.value)}
                  placeholder="8.50"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Proveedor *
                </label>
                <select
                  value={producto.proveedorId}
                  onChange={(e) => handleCambioProveedor(index, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={proveedoresDisponibles.length === 0}
                >
                  <option value="">Seleccionar...</option>
                  {proveedoresDisponibles.map(proveedor => (
                    <option key={proveedor.id} value={proveedor.id}>
                      {proveedor.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo *
                </label>
                <select
                  value={producto.tipo}
                  onChange={(e) => handleCambioTipo(index, e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="comida">🍕 Comida (Cocina)</option>
                  <option value="bebida">🥤 Bebida (Bar)</option>
                  <option value="otros">📦 Otros</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info sobre márgenes */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
        <h4 className="font-semibold text-yellow-900 mb-2">💡 Sobre los márgenes</h4>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>• <strong>Margen &gt; 100%:</strong> Excelente rentabilidad</li>
          <li>• <strong>Margen 50-100%:</strong> Buena rentabilidad</li>
          <li>• <strong>Margen &lt; 50%:</strong> Considera ajustar precios</li>
        </ul>
      </div>

      {/* Botones de navegación */}
      <div className="flex justify-between">
        <button
          type="button"
          onClick={onRetroceder}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
        >
          ← Atrás
        </button>

        <button
          type="button"
          onClick={handleContinuar}
          disabled={proveedoresDisponibles.length === 0}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
        >
          ✅ Completar configuración
        </button>
      </div>
    </div>
  );
}
