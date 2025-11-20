import { useState, useEffect } from 'react';
import { productoService } from '../services/productoService';

/**
 * Componente para seleccionar productos organizados por categorías
 * Ideal para meseros al crear comandas
 */
const ProductosPorCategoria = ({ onProductoSeleccionado, localId }) => {
  const [categorias, setCategorias] = useState([]);
  const [categoriaActiva, setCategoriaActiva] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    cargarProductos();
  }, [localId]);

  const cargarProductos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = { activo: true };
      if (localId) params.localId = localId;
      
      const response = await productoService.getAgrupados(params);
      
      if (response.success && response.data.length > 0) {
        setCategorias(response.data);
        setCategoriaActiva(response.data[0].categoria); // Activar primera categoría
      } else {
        setCategorias([]);
        setError('No hay productos disponibles');
      }
    } catch (err) {
      console.error('Error al cargar productos:', err);
      setError('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  const handleProductoClick = (producto) => {
    if (onProductoSeleccionado) {
      onProductoSeleccionado(producto);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Cargando productos...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        {error}
      </div>
    );
  }

  if (categorias.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800">
        No hay productos disponibles. Por favor, carga productos primero.
      </div>
    );
  }

  const productosCategoria = categorias.find(c => c.categoria === categoriaActiva);

  return (
    <div className="h-full flex flex-col">
      {/* Pestañas de Categorías */}
      <div className="border-b border-gray-200 bg-white">
        <nav className="flex space-x-1 overflow-x-auto px-4" aria-label="Categorías">
          {categorias.map((cat) => (
            <button
              key={cat.categoria}
              onClick={() => setCategoriaActiva(cat.categoria)}
              className={`
                px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors
                ${categoriaActiva === cat.categoria
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              {cat.categoria}
              <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-gray-100">
                {cat.total}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Lista de Productos */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {productosCategoria?.productos.map((producto) => (
            <button
              key={producto.id}
              onClick={() => handleProductoClick(producto)}
              className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-4 text-left border border-gray-200 hover:border-blue-400"
            >
              {/* Foto del producto (si existe) */}
              {producto.foto && (
                <div className="mb-3 rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={producto.foto}
                    alt={producto.nombre}
                    className="w-full h-32 object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}

              {/* Nombre */}
              <h3 className="font-semibold text-gray-900 mb-1">
                {producto.nombre}
              </h3>

              {/* Descripción (si existe) */}
              {producto.descripcion && (
                <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                  {producto.descripcion}
                </p>
              )}

              {/* Precio */}
              <div className="flex items-center justify-between mt-2">
                <span className="text-lg font-bold text-blue-600">
                  Bs. {parseFloat(producto.precio).toFixed(2)}
                </span>
                
                {/* Estado */}
                {!producto.activo && (
                  <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-800">
                    No disponible
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Mensaje si categoría vacía */}
        {productosCategoria?.productos.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No hay productos en esta categoría
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductosPorCategoria;
