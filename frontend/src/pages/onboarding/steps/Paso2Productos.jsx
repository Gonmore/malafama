import { useState } from 'react';
import { toast } from 'react-hot-toast';
import onboardingService from '../../../services/onboardingService';
import LoadingSpinner from '../../../components/LoadingSpinner';

export default function Paso2Productos({ onCompletar, onRetroceder, datosIniciales, moneda = 'Bs' }) {
  const [metodo, setMetodo] = useState('scraping'); // 'scraping' o 'manual'
  const [urlMenu, setUrlMenu] = useState('');
  const [loading, setLoading] = useState(false);
  const [productosScrapeados, setProductosScrapeados] = useState([]);
  
  // Productos manuales
  const [productosManual, setProductosManual] = useState(datosIniciales.length > 0 ? datosIniciales : [
    { nombre: '', categoria: 'Platos', precio: '', descripcion: '' }
  ]);

  const handleScrapear = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await onboardingService.previewScraping(urlMenu);
      
      if (response.data.productos.length === 0) {
        toast.error('No se encontraron productos. Intenta con otra URL o crea productos manualmente.');
        return;
      }

      setProductosScrapeados(response.data.productos);
      toast.success(`✅ ${response.data.total} productos encontrados`);
    } catch (error) {
      console.error('Error al scrapear:', error);
      toast.error(error.response?.data?.message || 'Error al extraer productos. Intenta con el método manual.');
      setMetodo('manual');
    } finally {
      setLoading(false);
    }
  };

  const handleAgregarProductoManual = () => {
    setProductosManual([
      ...productosManual,
      { nombre: '', categoria: 'Platos', precio: '', descripcion: '' }
    ]);
  };

  const handleEliminarProductoManual = (index) => {
    setProductosManual(productosManual.filter((_, i) => i !== index));
  };

  const handleCambioProductoManual = (index, field, value) => {
    const nuevosProductos = [...productosManual];
    nuevosProductos[index][field] = value;
    setProductosManual(nuevosProductos);
  };

  const handleContinuarConScrapeados = () => {
    if (productosScrapeados.length === 0) {
      toast.error('No hay productos scrapeados. Intenta scrapear primero.');
      return;
    }
    onCompletar({ productos: productosScrapeados, scrapeados: productosScrapeados });
  };

  const handleContinuarConManuales = () => {
    // Validar que al menos haya un producto con datos
    const productosValidos = productosManual.filter(p => p.nombre && p.precio);
    
    if (productosValidos.length === 0) {
      toast.error('Debes agregar al menos un producto con nombre y precio');
      return;
    }

    // Convertir precios a números
    const productosFormateados = productosValidos.map(p => ({
      ...p,
      precio: parseFloat(p.precio)
    }));

    onCompletar({ productos: productosFormateados, scrapeados: [] });
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        Paso 2: Crear Productos
      </h2>
      <p className="text-gray-600 mb-6">
        Elige cómo deseas agregar los productos de tu menú
      </p>

      {/* Selector de método */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <button
          type="button"
          onClick={() => setMetodo('scraping')}
          className={`p-4 border-2 rounded-lg transition-all ${
            metodo === 'scraping'
              ? 'border-blue-600 bg-blue-50'
              : 'border-gray-200 hover:border-blue-300'
          }`}
        >
          <div className="text-3xl mb-2">🌐</div>
          <h3 className="font-semibold text-gray-900">Web Scraping</h3>
          <p className="text-sm text-gray-500 mt-1">
            Extrae productos desde tu menú web
          </p>
        </button>

        <button
          type="button"
          onClick={() => setMetodo('manual')}
          className={`p-4 border-2 rounded-lg transition-all ${
            metodo === 'manual'
              ? 'border-blue-600 bg-blue-50'
              : 'border-gray-200 hover:border-blue-300'
          }`}
        >
          <div className="text-3xl mb-2">✏️</div>
          <h3 className="font-semibold text-gray-900">Crear Manualmente</h3>
          <p className="text-sm text-gray-500 mt-1">
            Agrega tus productos uno por uno
          </p>
        </button>
      </div>

      {/* Método Scraping */}
      {metodo === 'scraping' && (
        <div>
          <form onSubmit={handleScrapear} className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL de tu menú web *
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={urlMenu}
                onChange={(e) => setUrlMenu(e.target.value)}
                placeholder="https://turestaurante.com/menu"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
              >
                {loading ? 'Extrayendo...' : 'Extraer'}
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              💡 Tip: Ingresa la URL donde están listados tus productos con precios
            </p>
          </form>

          {loading && (
            <div className="flex justify-center py-8">
              <LoadingSpinner text="Extrayendo productos del menú..." />
            </div>
          )}

          {/* Productos scrapeados */}
          {productosScrapeados.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-green-900 mb-3">
                ✅ {productosScrapeados.length} productos encontrados
              </h3>
              <div className="max-h-96 overflow-y-auto space-y-2">
                {productosScrapeados.map((producto, index) => (
                  <div
                    key={index}
                    className="bg-white rounded p-3 flex justify-between items-start"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{producto.nombre}</p>
                      {producto.descripcion && (
                        <p className="text-sm text-gray-500">{producto.descripcion}</p>
                      )}
                      <p className="text-sm text-gray-600 mt-1">
                        Categoría: {producto.categoria || 'Sin categoría'}
                      </p>
                    </div>
                    <span className="text-lg font-semibold text-green-600">
                      {moneda}{parseFloat(producto.precio).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-sm text-green-700 mt-3">
                En el siguiente paso asignarás costo y proveedor a cada producto
              </p>
            </div>
          )}
        </div>
      )}

      {/* Método Manual */}
      {metodo === 'manual' && (
        <div>
          <div className="space-y-4 mb-4">
            {productosManual.map((producto, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre del producto *
                    </label>
                    <input
                      type="text"
                      value={producto.nombre}
                      onChange={(e) => handleCambioProductoManual(index, 'nombre', e.target.value)}
                      placeholder="Ej: Pizza Margarita"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Categoría *
                    </label>
                    <select
                      value={producto.categoria}
                      onChange={(e) => handleCambioProductoManual(index, 'categoria', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Platos">Platos</option>
                      <option value="Pizzas">Pizzas</option>
                      <option value="Hamburguesas">Hamburguesas</option>
                      <option value="Ensaladas">Ensaladas</option>
                      <option value="Pastas">Pastas</option>
                      <option value="Bebidas">Bebidas</option>
                      <option value="Postres">Postres</option>
                      <option value="Otros">Otros</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Precio de venta * ({moneda})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={producto.precio}
                      onChange={(e) => handleCambioProductoManual(index, 'precio', e.target.value)}
                      placeholder="15.99"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Descripción (opcional)
                    </label>
                    <input
                      type="text"
                      value={producto.descripcion}
                      onChange={(e) => handleCambioProductoManual(index, 'descripcion', e.target.value)}
                      placeholder="Ingredientes o descripción breve"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {productosManual.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleEliminarProductoManual(index)}
                    className="mt-3 text-sm text-red-600 hover:text-red-700"
                  >
                    🗑️ Eliminar producto
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAgregarProductoManual}
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            + Agregar otro producto
          </button>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
            <p className="text-sm text-blue-800">
              💡 <strong>Tip:</strong> En el siguiente paso asignarás el costo y proveedor de cada producto
            </p>
          </div>
        </div>
      )}

      {/* Botones de navegación */}
      <div className="flex justify-between mt-8">
        <button
          type="button"
          onClick={onRetroceder}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
        >
          ← Atrás
        </button>

        {metodo === 'scraping' ? (
          <button
            type="button"
            onClick={handleContinuarConScrapeados}
            disabled={productosScrapeados.length === 0}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Continuar con estos productos →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleContinuarConManuales}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
          >
            Continuar →
          </button>
        )}
      </div>
    </div>
  );
}
