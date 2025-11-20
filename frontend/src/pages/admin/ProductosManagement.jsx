import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { useLocalStore } from '../../store/localStore';
import productoService from '../../services/productoService';
import proveedorService from '../../services/proveedorService';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function ProductosManagement() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { localActivo } = useLocalStore();
  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState('todas');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [productoSeleccionado, setProductoSeleccionado] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingField, setEditingField] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    precio: '',
    costo: '',
    categoria: '',
    tipo: 'otros',
    proveedorId: '',
    activo: true
  });

  const moneda = localActivo?.moneda || user?.local?.moneda || 'Bs';

  const categorias = ['Platos', 'Bebidas', 'Postres', 'Snacks', 'Cervezas'];
  const tipos = [
    { value: 'comida', label: '🍽️ Comida' },
    { value: 'bebida', label: '🍹 Bebida' },
    { value: 'otros', label: '📦 Otros' }
  ];

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [responseProd, responseProv] = await Promise.all([
        productoService.getAll({ localId: user.localId }),
        proveedorService.getAll()
      ]);

      setProductos(responseProd.data?.productos || responseProd.data || []);
      setProveedores(responseProv.data?.proveedores || responseProv.data || []);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      toast.error('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nombre || !formData.precio || !formData.costo) {
      toast.error('Completa los campos requeridos');
      return;
    }

    try {
      const data = {
        ...formData,
        precio: parseFloat(formData.precio),
        costo: parseFloat(formData.costo),
        localId: user.localId,
        proveedorId: formData.proveedorId || null
      };

      if (productoSeleccionado) {
        await productoService.update(productoSeleccionado.id, data);
        toast.success('Producto actualizado');
      } else {
        await productoService.create(data);
        toast.success('Producto creado');
      }

      setShowModal(false);
      resetForm();
      cargarDatos();
    } catch (error) {
      console.error('Error al guardar producto:', error);
      toast.error('Error al guardar producto');
    }
  };

  const handleEliminar = async (producto) => {
    if (!confirm(`¿Eliminar ${producto.nombre}?`)) return;

    try {
      await productoService.delete(producto.id);
      toast.success('Producto eliminado');
      cargarDatos();
    } catch (error) {
      console.error('Error al eliminar:', error);
      toast.error('Error al eliminar producto');
    }
  };

  const openEditModal = (producto) => {
    setProductoSeleccionado(producto);
    setFormData({
      nombre: producto.nombre,
      descripcion: producto.descripcion || '',
      precio: producto.precio,
      costo: producto.costo,
      categoria: producto.categoria || '',
      tipo: producto.tipo || 'otros',
      proveedorId: producto.proveedorId || '',
      activo: producto.activo
    });
    setShowModal(true);
  };

  const openNewModal = () => {
    resetForm();
    setShowModal(true);
  };

  const resetForm = () => {
    setProductoSeleccionado(null);
    setFormData({
      nombre: '',
      descripcion: '',
      precio: '',
      costo: '',
      categoria: '',
      tipo: 'otros',
      proveedorId: '',
      activo: true
    });
  };

  const productosFiltrados = productos.filter(p => {
    const matchCategoria = filtroCategoria === 'todas' || p.categoria === filtroCategoria;
    const matchTipo = filtroTipo === 'todos' || p.tipo === filtroTipo;
    const matchBusqueda = p.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return matchCategoria && matchTipo && matchBusqueda;
  });

  const getTipoBadge = (tipo) => {
    const badges = {
      comida: { bg: 'bg-blue-100', text: 'text-blue-800', icon: '🍽️' },
      bebida: { bg: 'bg-green-100', text: 'text-green-800', icon: '🍹' },
      otros: { bg: 'bg-gray-100', text: 'text-gray-800', icon: '📦' }
    };
    return badges[tipo] || badges.otros;
  };

  const calcularMargen = (precio, costo) => {
    if (!precio || !costo) return 0;
    return (((precio - costo) / precio) * 100).toFixed(1);
  };

  const startEdit = (productoId, field, value) => {
    setEditingId(productoId);
    setEditingField(field);
    setEditingValue(value);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingField(null);
    setEditingValue('');
  };

  const saveEdit = async (producto) => {
    if (!editingValue || editingValue === producto[editingField]) {
      cancelEdit();
      return;
    }

    try {
      let value = editingValue;
      
      // Parsear números si es precio o costo
      if (editingField === 'precio' || editingField === 'costo') {
        value = parseFloat(editingValue);
        if (isNaN(value) || value < 0) {
          toast.error('Valor inválido');
          return;
        }
      }

      await productoService.update(producto.id, {
        ...producto,
        [editingField]: value
      });

      // Actualizar localmente
      setProductos(productos.map(p => 
        p.id === producto.id ? { ...p, [editingField]: value } : p
      ));

      toast.success('Producto actualizado');
      cancelEdit();
    } catch (error) {
      console.error('Error al actualizar:', error);
      toast.error('Error al actualizar producto');
    }
  };

  const handleKeyDown = (e, producto) => {
    if (e.key === 'Enter') {
      saveEdit(producto);
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner text="Cargando productos..." />
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
              <h1 className="text-3xl font-bold text-gray-900">🍽️ Gestión de Productos</h1>
              <p className="text-gray-600 mt-1">Administra tu menú y precios</p>
            </div>
            <button
              onClick={openNewModal}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Nuevo Producto
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Buscar</label>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Categoría</label>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todas">Todas</option>
                {categorias.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todos">Todos</option>
                {tipos.map(tipo => (
                  <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm text-gray-500">Total Productos</p>
            <p className="text-2xl font-bold text-gray-900">{productos.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm text-gray-500">Activos</p>
            <p className="text-2xl font-bold text-green-600">{productos.filter(p => p.activo).length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm text-gray-500">Precio Promedio</p>
            <p className="text-2xl font-bold text-blue-600">
              {moneda} {(productos.reduce((sum, p) => sum + parseFloat(p.precio), 0) / productos.length || 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm text-gray-500">Margen Promedio</p>
            <p className="text-2xl font-bold text-purple-600">
              {(productos.reduce((sum, p) => sum + parseFloat(calcularMargen(p.precio, p.costo)), 0) / productos.length || 0).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Tabla de Productos */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {/* Vista Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Producto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Categoría</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Precio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Costo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Margen</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Proveedor</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {productosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                      No hay productos para mostrar
                    </td>
                  </tr>
                ) : (
                  productosFiltrados.map((producto) => {
                    const tipoBadge = getTipoBadge(producto.tipo);
                    const margen = calcularMargen(producto.precio, producto.costo);
                    const isEditing = editingId === producto.id;
                    
                    return (
                      <tr key={producto.id} className="hover:bg-gray-50">
                        {/* Nombre - Editable */}
                        <td className="px-6 py-4">
                          {isEditing && editingField === 'nombre' ? (
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, producto)}
                              onBlur={() => saveEdit(producto)}
                              autoFocus
                              className="w-full px-2 py-1 border border-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <div 
                              className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                              onClick={() => startEdit(producto.id, 'nombre', producto.nombre)}
                            >
                              <div className="text-sm font-medium text-gray-900">{producto.nombre}</div>
                              {producto.descripcion && (
                                <div className="text-sm text-gray-500 truncate max-w-xs">{producto.descripcion}</div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Tipo - Editable */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isEditing && editingField === 'tipo' ? (
                            <select
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={() => saveEdit(producto)}
                              autoFocus
                              className="px-2 py-1 border border-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                            >
                              {tipos.map(t => (
                                <option key={t.value} value={t.value}>{t.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span 
                              className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer ${tipoBadge.bg} ${tipoBadge.text}`}
                              onClick={() => startEdit(producto.id, 'tipo', producto.tipo)}
                            >
                              {tipoBadge.icon} {producto.tipo}
                            </span>
                          )}
                        </td>

                        {/* Categoría - Editable */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isEditing && editingField === 'categoria' ? (
                            <select
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={() => saveEdit(producto)}
                              autoFocus
                              className="px-2 py-1 border border-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">-</option>
                              {categorias.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                          ) : (
                            <div 
                              className="text-sm text-gray-900 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                              onClick={() => startEdit(producto.id, 'categoria', producto.categoria || '')}
                            >
                              {producto.categoria || '-'}
                            </div>
                          )}
                        </td>

                        {/* Precio - Editable */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isEditing && editingField === 'precio' ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, producto)}
                              onBlur={() => saveEdit(producto)}
                              autoFocus
                              className="w-20 px-2 py-1 border border-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <div 
                              className="text-sm font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                              onClick={() => startEdit(producto.id, 'precio', producto.precio)}
                            >
                              {moneda} {producto.precio}
                            </div>
                          )}
                        </td>

                        {/* Costo - Editable */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          {isEditing && editingField === 'costo' ? (
                            <input
                              type="number"
                              step="0.01"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, producto)}
                              onBlur={() => saveEdit(producto)}
                              autoFocus
                              className="w-20 px-2 py-1 border border-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <div 
                              className="text-sm text-gray-600 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded"
                              onClick={() => startEdit(producto.id, 'costo', producto.costo)}
                            >
                              {moneda} {producto.costo}
                            </div>
                          )}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`text-sm font-bold ${margen > 50 ? 'text-green-600' : margen > 30 ? 'text-blue-600' : 'text-orange-600'}`}>
                            {margen}%
                          </span>
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {producto.proveedor?.nombre || '-'}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => saveEdit(producto)}
                                  className="text-green-600 hover:text-green-900"
                                  title="Guardar"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>
                                <button
                                  onClick={cancelEdit}
                                  className="text-red-600 hover:text-red-900"
                                  title="Cancelar"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => openEditModal(producto)}
                                  className="text-blue-600 hover:text-blue-900"
                                  title="Editar completo"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={() => handleEliminar(producto)}
                                  className="text-red-600 hover:text-red-900"
                                  title="Eliminar"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Vista Mobile - Cards */}
          <div className="lg:hidden divide-y divide-gray-200">
            {productosFiltrados.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No hay productos para mostrar
              </div>
            ) : (
              productosFiltrados.map((producto) => {
                const tipoBadge = getTipoBadge(producto.tipo);
                const margen = calcularMargen(producto.precio, producto.costo);
                const isEditing = editingId === producto.id;

                return (
                  <div key={producto.id} className="p-4 hover:bg-gray-50">
                    {/* Header con nombre y acciones */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        {isEditing && editingField === 'nombre' ? (
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, producto)}
                            onBlur={() => saveEdit(producto)}
                            autoFocus
                            className="w-full px-2 py-1 border border-blue-500 rounded focus:ring-2 focus:ring-blue-500 text-base font-semibold"
                          />
                        ) : (
                          <div 
                            className="cursor-pointer hover:bg-gray-100 px-2 py-1 rounded -ml-2"
                            onClick={() => startEdit(producto.id, 'nombre', producto.nombre)}
                          >
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                              {producto.nombre}
                              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </h3>
                            {producto.descripcion && (
                              <p className="text-sm text-gray-500 mt-1">{producto.descripcion}</p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEdit(producto)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => openEditModal(producto)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleEliminar(producto)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Grid de información editable */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {/* Tipo */}
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Tipo</label>
                        {isEditing && editingField === 'tipo' ? (
                          <select
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => saveEdit(producto)}
                            autoFocus
                            className="w-full px-2 py-1 border border-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                          >
                            {tipos.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span 
                            className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full cursor-pointer ${tipoBadge.bg} ${tipoBadge.text}`}
                            onClick={() => startEdit(producto.id, 'tipo', producto.tipo)}
                          >
                            {tipoBadge.icon} {producto.tipo}
                          </span>
                        )}
                      </div>

                      {/* Categoría */}
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Categoría</label>
                        {isEditing && editingField === 'categoria' ? (
                          <select
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => saveEdit(producto)}
                            autoFocus
                            className="w-full px-2 py-1 border border-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">-</option>
                            {categorias.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        ) : (
                          <div 
                            className="text-gray-900 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded -ml-2 flex items-center gap-1"
                            onClick={() => startEdit(producto.id, 'categoria', producto.categoria || '')}
                          >
                            {producto.categoria || '-'}
                            <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Precio */}
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Precio</label>
                        {isEditing && editingField === 'precio' ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, producto)}
                            onBlur={() => saveEdit(producto)}
                            autoFocus
                            className="w-full px-2 py-1 border border-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <div 
                            className="font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded -ml-2 flex items-center gap-1"
                            onClick={() => startEdit(producto.id, 'precio', producto.precio)}
                          >
                            {moneda} {producto.precio}
                            <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Costo */}
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Costo</label>
                        {isEditing && editingField === 'costo' ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, producto)}
                            onBlur={() => saveEdit(producto)}
                            autoFocus
                            className="w-full px-2 py-1 border border-blue-500 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <div 
                            className="text-gray-600 cursor-pointer hover:bg-gray-100 px-2 py-1 rounded -ml-2 flex items-center gap-1"
                            onClick={() => startEdit(producto.id, 'costo', producto.costo)}
                          >
                            {moneda} {producto.costo}
                            <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Margen */}
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Margen</label>
                        <span className={`text-sm font-bold ${margen > 50 ? 'text-green-600' : margen > 30 ? 'text-blue-600' : 'text-orange-600'}`}>
                          {margen}%
                        </span>
                      </div>

                      {/* Proveedor */}
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Proveedor</label>
                        <span className="text-gray-600">{producto.proveedor?.nombre || '-'}</span>
                      </div>
                    </div>

                    {/* Hint de edición */}
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        Toca cualquier campo para editar
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      {/* Modal Crear/Editar */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {productoSeleccionado ? 'Editar Producto' : 'Nuevo Producto'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                  <textarea
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.precio}
                    onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Costo *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.costo}
                    onChange={(e) => setFormData({ ...formData, costo: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Seleccionar...</option>
                    {categorias.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo *</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {tipos.map(tipo => (
                      <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Proveedor</label>
                  <select
                    value={formData.proveedorId}
                    onChange={(e) => setFormData({ ...formData, proveedorId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sin proveedor</option>
                    {proveedores.map(prov => (
                      <option key={prov.id} value={prov.id}>{prov.nombre}</option>
                    ))}
                  </select>
                </div>

                {formData.precio && formData.costo && (
                  <div className="col-span-2 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">Margen de ganancia:</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {calcularMargen(formData.precio, formData.costo)}%
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {productoSeleccionado ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
