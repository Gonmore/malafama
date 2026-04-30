import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { useLocalStore } from '../../store/localStore';
import productoService from '../../services/productoService';
import proveedorService from '../../services/proveedorService';
import scrapingService from '../../services/scrapingService';
import LoadingSpinner from '../../components/LoadingSpinner';
import ProveedorModal from '../../components/ProveedorModal';

export default function ProductosManagement() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { localActivo } = useLocalStore();
  const effectiveLocalId = localActivo?.id || user?.localId || null;
  const previewJobTimerRef = useRef(null);
  const loadedForLocalRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [productos, setProductos] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [proveedorModalOpen, setProveedorModalOpen] = useState(false);
  const [editingProveedor, setEditingProveedor] = useState(null);
  const [categoriaModalOpen, setCategoriaModalOpen] = useState(false);
  const [categoriaModalMode, setCategoriaModalMode] = useState('edit');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState('');
  const [categoriaNombre, setCategoriaNombre] = useState('');
  const [categoriaSaving, setCategoriaSaving] = useState(false);
  const [pendingCategoriaTarget, setPendingCategoriaTarget] = useState(null);
  const [categoriasGuardadas, setCategoriasGuardadas] = useState([]);
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

  const [showScraping, setShowScraping] = useState(false);
  const [scrapingUrl, setScrapingUrl] = useState('');
  const [scrapingLoading, setScrapingLoading] = useState(false);
  const [scrapingPreview, setScrapingPreview] = useState([]);
  const [scrapingTotal, setScrapingTotal] = useState(0);
  const [scrapingImporting, setScrapingImporting] = useState(false);
  const [scrapingProgress, setScrapingProgress] = useState({
    percent: 0,
    message: '',
    productsFound: 0
  });

  const moneda = localActivo?.moneda || user?.local?.moneda || 'Bs';

  const categoriasBase = ['Platos', 'Bebidas', 'Postres', 'Snacks', 'Cervezas'];
  const tipos = [
    { value: 'comida', label: '🍽️ Comida' },
    { value: 'bebida', label: '🍹 Bebida' },
    { value: 'otros', label: '📦 Otros' }
  ];

  const categoriaStats = useMemo(() => {
    const stats = new Map();
    categoriasGuardadas.forEach((categoria) => {
      const nombre = String(categoria.nombre || '').trim();
      if (!nombre) return;
      stats.set(nombre, categoria.cantidad || 0);
    });
    productos.forEach((producto) => {
      const nombre = String(producto.categoria || '').trim();
      if (!nombre) return;
      if (!stats.has(nombre)) {
        stats.set(nombre, 0);
      }
    });
    return Array.from(stats.entries())
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [categoriasGuardadas, productos]);

  const categorias = useMemo(() => {
    const nombres = new Set(categoriasBase);
    categoriaStats.forEach((cat) => nombres.add(cat.nombre));
    return Array.from(nombres).sort((a, b) => a.localeCompare(b));
  }, [categoriaStats]);

  useEffect(() => {
    if (loadedForLocalRef.current === effectiveLocalId) return;
    loadedForLocalRef.current = effectiveLocalId;
    cargarDatos();
  }, [effectiveLocalId]);

  useEffect(() => {
    return () => {
      if (previewJobTimerRef.current) {
        clearInterval(previewJobTimerRef.current);
        previewJobTimerRef.current = null;
      }
    };
  }, []);

  const extractList = (payload) => {
    if (!payload) return null;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.productos)) return payload.productos;
    if (Array.isArray(payload.proveedores)) return payload.proveedores;
    return [];
  };

  const cargarDatos = async () => {
    if (!effectiveLocalId) {
      setProductos([]);
      setProveedores([]);
      setCategoriasGuardadas([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [resProd, resProv, resCat] = await Promise.allSettled([
        productoService.getAll({ localId: effectiveLocalId }),
        proveedorService.getAll({ localId: effectiveLocalId }),
        productoService.getCategorias({ localId: effectiveLocalId })
      ]);

      if (resProd.status === 'fulfilled') {
        setProductos(extractList(resProd.value) || []);
      } else {
        const status = resProd.reason?.response?.status;
        if (status !== 401) toast.error('Error al cargar productos');
        console.error('Error al cargar productos:', resProd.reason);
      }

      if (resProv.status === 'fulfilled') {
        setProveedores(extractList(resProv.value) || []);
      } else {
        console.error('Error al cargar proveedores:', resProv.reason);
      }

      if (resCat.status === 'fulfilled') {
        setCategoriasGuardadas(extractList(resCat.value) || []);
      } else {
        console.error('Error al cargar categorías:', resCat.reason);
        setCategoriasGuardadas([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const cargarProveedores = async () => {
    if (!effectiveLocalId) {
      setProveedores([]);
      return;
    }
    try {
      const responseProv = await proveedorService.getAll({ localId: effectiveLocalId, t: Date.now() });
      setProveedores(responseProv.data?.proveedores || responseProv.data || []);
    } catch (err) {
      console.error('Error al cargar proveedores:', err);
      setProveedores([]);
    }
  };

  const openCategoriaModal = (categoria) => {
    setCategoriaModalMode('edit');
    setCategoriaSeleccionada(categoria);
    setCategoriaNombre(categoria);
    setPendingCategoriaTarget(null);
    setCategoriaModalOpen(true);
  };

  const openNuevaCategoriaModal = (target = null) => {
    setCategoriaModalMode('create');
    setCategoriaSeleccionada('');
    setCategoriaNombre('');
    setPendingCategoriaTarget(target);
    setCategoriaModalOpen(true);
  };

  const closeCategoriaModal = () => {
    setCategoriaModalOpen(false);
    setCategoriaModalMode('edit');
    setCategoriaSeleccionada('');
    setCategoriaNombre('');
    setPendingCategoriaTarget(null);
  };

  const handleGuardarCategoria = async (e) => {
    e.preventDefault();
    const nombre = categoriaNombre.trim();

    if (!nombre) {
      toast.error('Ingresa un nombre de categoría');
      return;
    }

    if (categoriaModalMode === 'edit' && nombre === categoriaSeleccionada) {
      closeCategoriaModal();
      return;
    }

    try {
      setCategoriaSaving(true);

      if (categoriaModalMode === 'create') {
        await productoService.createCategoria(nombre, effectiveLocalId);

        if (pendingCategoriaTarget?.type === 'form') {
          setFormData((prev) => ({ ...prev, categoria: nombre }));
        }

        if (pendingCategoriaTarget?.type === 'inline' && pendingCategoriaTarget.producto) {
          const producto = pendingCategoriaTarget.producto;
          await productoService.update(producto.id, {
            ...producto,
            categoria: nombre
          });
          setProductos((prev) => prev.map((p) => (
            p.id === producto.id ? { ...p, categoria: nombre } : p
          )));
          cancelEdit();
        }

        toast.success('Categoría creada');
      } else {
        await productoService.renameCategoria(categoriaSeleccionada, nombre, effectiveLocalId);
        toast.success('Categoría actualizada');
        if (filtroCategoria === categoriaSeleccionada) {
          setFiltroCategoria(nombre);
        }
      }

      closeCategoriaModal();
      await cargarDatos();
    } catch (err) {
      console.error('Error al actualizar categoría:', err);
      toast.error(err?.response?.data?.message || 'Error al guardar categoría');
    } finally {
      setCategoriaSaving(false);
    }
  };

  const handleCategoriaFormChange = (value) => {
    if (value === '__add__') {
      openNuevaCategoriaModal({ type: 'form' });
      return;
    }
    setFormData({ ...formData, categoria: value });
  };

  const handleCategoriaInlineChange = (producto, value) => {
    if (value === '__add__') {
      openNuevaCategoriaModal({ type: 'inline', producto });
      return;
    }
    setEditingValue(value);
  };

  const detectarTipoPorCategoria = (categoria) => {
    const c = (categoria || '').toLowerCase();
    if (c.includes('bebida') || c.includes('trago') || c.includes('cerveza') || c.includes('vino') || c.includes('coctel') || c.includes('cocktail')) {
      return 'bebida';
    }
    if (c.includes('comida') || c.includes('pizza') || c.includes('hamburguesa') || c.includes('entrada') || c.includes('plato') || c.includes('picoteo') || c.includes('menú') || c.includes('menu')) {
      return 'comida';
    }
    return 'otros';
  };

  const handlePreviewScraping = async () => {
    // Backwards-compatible wrapper; keep only one implementation.
    return handlePreviewScrapingConProgreso();
  };

  const handlePreviewScrapingConProgreso = async () => {
    const url = (scrapingUrl || '').trim();
    if (!url) {
      toast.error('Ingresa una URL');
      return;
    }
    if (!effectiveLocalId) {
      toast.error('Selecciona un local antes de importar');
      return;
    }

    try {
      if (previewJobTimerRef.current) {
        clearInterval(previewJobTimerRef.current);
        previewJobTimerRef.current = null;
      }

      setScrapingLoading(true);
      setScrapingProgress({ percent: 0, message: 'Iniciando...', productsFound: 0 });
      setScrapingPreview([]);
      setScrapingTotal(0);

      const start = await scrapingService.startPreviewJob(url);
      const jobId = start.data?.id;
      if (!jobId) throw new Error('No se recibió jobId');

      previewJobTimerRef.current = setInterval(async () => {
        try {
          const st = await scrapingService.getPreviewJob(jobId);
          const data = st.data;
          const percent = typeof data.progress === 'number' ? data.progress : 0;
          const msg = data.message || '';
          const found = typeof data.productsFound === 'number' ? data.productsFound : 0;
          setScrapingProgress({ percent, message: msg, productsFound: found });

          if (data.status === 'done') {
            clearInterval(previewJobTimerRef.current);
            previewJobTimerRef.current = null;
            const items = data.productos || [];
            setScrapingPreview(items);
            setScrapingTotal(data.total || items.length);
            setScrapingLoading(false);
            setScrapingProgress({ percent: 100, message: 'Listo', productsFound: items.length });
          }

          if (data.status === 'error') {
            clearInterval(previewJobTimerRef.current);
            previewJobTimerRef.current = null;
            setScrapingLoading(false);
            toast.error(data.error || 'Error al previsualizar scraping');
          }
        } catch (e) {
          // ignore transient polling errors
        }
      }, 500);
    } catch (err) {
      if (previewJobTimerRef.current) {
        clearInterval(previewJobTimerRef.current);
        previewJobTimerRef.current = null;
      }
      console.error('Error preview scraping:', err);
      toast.error(err.response?.data?.message || err.message || 'Error al previsualizar scraping');
      setScrapingPreview([]);
      setScrapingTotal(0);
      setScrapingProgress({ percent: 0, message: '', productsFound: 0 });
    }
  };

  const handleImportarScraping = async () => {
    if (!effectiveLocalId) {
      toast.error('Selecciona un local antes de importar');
      return;
    }

    const normalizados = (scrapingPreview || [])
      .map((p) => {
        const precio = typeof p.precio === 'number' ? p.precio : parseFloat(String(p.precio || '').replace(',', '.'));
        return {
          nombre: p.nombre,
          descripcion: p.descripcion || '',
          foto: p.foto || null,
          precio: Number.isFinite(precio) ? precio : null,
          costo: 0,
          categoria: p.categoria || 'Otros',
          tipo: detectarTipoPorCategoria(p.categoria),
          proveedorId: null,
          localId: effectiveLocalId,
          activo: true
        };
      })
      .filter((p) => p.nombre && p.precio !== null);

    if (normalizados.length === 0) {
      toast.error('No hay productos válidos para importar');
      return;
    }

    try {
      setScrapingImporting(true);
      setScrapingProgress({ percent: 0, message: 'Importando...', productsFound: 0 });

      const chunkSize = 100;
      let imported = 0;
      for (let i = 0; i < normalizados.length; i += chunkSize) {
        const chunk = normalizados.slice(i, i + chunkSize);
        await productoService.createBulk(chunk);
        imported += chunk.length;
        const percent = Math.round((imported / normalizados.length) * 100);
        setScrapingProgress({
          percent,
          message: `Importando... (${imported}/${normalizados.length})`,
          productsFound: imported
        });
      }

      toast.success(`✅ ${normalizados.length} productos importados`);
      setShowScraping(false);
      setScrapingPreview([]);
      setScrapingTotal(0);
      setScrapingUrl('');
      await cargarDatos();
    } catch (err) {
      console.error('Error import scraping:', err);
      toast.error(err.response?.data?.message || 'Error al importar productos');
    } finally {
      setScrapingImporting(false);
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
        localId: effectiveLocalId,
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
      setProductos((prev) => prev.filter((p) => p.id !== producto.id));
      toast.success('Producto eliminado');
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
      comida: { bg: 'bg-blue-900/30', text: 'text-blue-800', icon: '🍽️' },
      bebida: { bg: 'bg-green-900/30', text: 'text-green-800', icon: '🍹' },
      otros: { bg: 'bg-slate-800', text: 'text-slate-200', icon: '📦' }
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
    const normalizedValue = editingField === 'categoria' ? editingValue.trim() : editingValue;
    if ((editingField !== 'categoria' && !editingValue) || normalizedValue === (producto[editingField] || '')) {
      cancelEdit();
      return;
    }

    try {
      let value = normalizedValue;
      
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
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <LoadingSpinner text="Cargando productos..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 shadow-sm border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => navigate(effectiveLocalId ? `/admin/local/${effectiveLocalId}` : '/admin')}
                className="text-blue-600 hover:text-blue-700 mb-2 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Volver al local
              </button>
              <h1 className="text-3xl font-bold text-slate-100">🍽️ Gestión de Productos</h1>
              <p className="text-slate-400 mt-1">Administra tu menú y precios</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowScraping((v) => !v)}
                className="px-4 py-3 bg-slate-800 border border-slate-600 text-slate-200 rounded-lg hover:bg-slate-900 transition-colors font-medium"
              >
                Importar por scraping
              </button>
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
        </div>
      </header>

      {showScraping && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-[260px]">
                <label className="block text-sm font-medium text-slate-300 mb-1">URL del menú</label>
                <input
                  value={scrapingUrl}
                  onChange={(e) => setScrapingUrl(e.target.value)}
                  placeholder="https://malafamacomedia.com/menu/"
                  className="w-full border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-lg px-3 py-2"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Importa productos al local activo. Costo se setea en 0 para editar después.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePreviewScrapingConProgreso}
                  disabled={scrapingLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {scrapingLoading ? 'Previsualizando...' : 'Previsualizar'}
                </button>
                <button
                  onClick={handleImportarScraping}
                  disabled={scrapingImporting || scrapingPreview.length === 0}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {scrapingImporting ? 'Importando...' : 'Importar'}
                </button>
              </div>
            </div>

            {(scrapingLoading || scrapingImporting) && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm text-slate-300 mb-1">
                  <span>{scrapingProgress.message || (scrapingImporting ? 'Importando...' : 'Procesando...')}</span>
                  <span className="font-medium">{scrapingProgress.percent}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, scrapingProgress.percent))}%` }}
                  />
                </div>
                {(scrapingProgress.productsFound || 0) > 0 && (
                  <p className="text-xs text-slate-400 mt-2">
                    Productos encontrados/importados: {scrapingProgress.productsFound}
                  </p>
                )}
              </div>
            )}

            {scrapingTotal > 0 && (
              <div className="mt-4">
                <p className="text-sm text-slate-300 mb-2">
                  Encontrados: <span className="font-semibold">{scrapingTotal}</span>
                </p>
                <div className="max-h-64 overflow-auto border border-slate-700 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-900">
                      <tr>
                        <th className="text-left px-3 py-2 text-slate-400 font-medium">Producto</th>
                        <th className="text-left px-3 py-2 text-slate-400 font-medium">Categoría</th>
                        <th className="text-right px-3 py-2 text-slate-400 font-medium">Precio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scrapingPreview.slice(0, 100).map((p, idx) => (
                        <tr key={`${p.nombre}-${idx}`} className="border-t">
                          <td className="px-3 py-2 text-slate-200">{p.nombre}</td>
                          <td className="px-3 py-2 text-slate-400">{p.categoria || 'Otros'}</td>
                          <td className="px-3 py-2 text-right text-slate-200">{p.precio}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {scrapingPreview.length > 100 && (
                  <p className="text-xs text-slate-400 mt-2">Mostrando 100 de {scrapingPreview.length} en preview</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <datalist id="categorias-productos">
          {categorias.map(cat => (
            <option key={cat} value={cat} />
          ))}
        </datalist>

        {/* Filtros */}
        <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700 p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Buscar</label>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre..."
                className="w-full px-4 py-2 border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Categoría</label>
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="w-full px-4 py-2 border border-slate-600 bg-slate-700 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todas">Todas</option>
                {categorias.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Tipo</label>
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="w-full px-4 py-2 border border-slate-600 bg-slate-700 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todos">Todos</option>
                {tipos.map(tipo => (
                  <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Categorias */}
        <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700 p-4 mb-6">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Categorías</h2>
              <p className="text-sm text-slate-400">Crea o renombra categorías para usarlas en productos.</p>
            </div>
            <button
              type="button"
              onClick={() => openNuevaCategoriaModal()}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              Nueva categoría
            </button>
          </div>
          {categoriaStats.length === 0 ? (
            <p className="text-sm text-slate-400">Aún no hay categorías asignadas.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {categoriaStats.map((cat) => (
                <button
                  key={cat.nombre}
                  type="button"
                  onClick={() => openCategoriaModal(cat.nombre)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-600 text-slate-200 hover:bg-slate-700"
                  title="Editar categoría"
                >
                  <span>{cat.nombre}</span>
                  <span className="text-xs text-slate-400">({cat.cantidad})</span>
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-700">
            <p className="text-sm text-slate-400">Total Productos</p>
            <p className="text-2xl font-bold text-slate-100">{productos.length}</p>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-700">
            <p className="text-sm text-slate-400">Activos</p>
            <p className="text-2xl font-bold text-green-600">{productos.filter(p => p.activo).length}</p>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-700">
            <p className="text-sm text-slate-400">Precio Promedio</p>
            <p className="text-2xl font-bold text-blue-600">
              {moneda} {(productos.reduce((sum, p) => sum + parseFloat(p.precio), 0) / productos.length || 0).toFixed(2)}
            </p>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg shadow-sm border border-slate-700">
            <p className="text-sm text-slate-400">Margen Promedio</p>
            <p className="text-2xl font-bold text-purple-600">
              {(productos.reduce((sum, p) => sum + parseFloat(calcularMargen(p.precio, p.costo)), 0) / productos.length || 0).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Tabla de Productos */}
        <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700 overflow-hidden">
          {/* Vista Desktop */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-700">
              <thead className="bg-slate-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Producto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Categoría</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Precio</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Costo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Margen</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">Proveedor</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-slate-800 divide-y divide-slate-700">
                {productosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="px-6 py-12 text-center text-slate-400">
                      No hay productos para mostrar
                    </td>
                  </tr>
                ) : (
                  productosFiltrados.map((producto) => {
                    const tipoBadge = getTipoBadge(producto.tipo);
                    const margen = calcularMargen(producto.precio, producto.costo);
                    const isEditing = editingId === producto.id;
                    
                    return (
                      <tr key={producto.id} className="hover:bg-slate-900">
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
                              className="w-full px-2 py-1 border border-blue-500 bg-slate-700 text-slate-100 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <div 
                              className="cursor-pointer hover:bg-slate-800 px-2 py-1 rounded"
                              onClick={() => startEdit(producto.id, 'nombre', producto.nombre)}
                            >
                              <div className="text-sm font-medium text-slate-100">{producto.nombre}</div>
                              {producto.descripcion && (
                                <div className="text-sm text-slate-400 truncate max-w-xs">{producto.descripcion}</div>
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
                              className="px-2 py-1 border border-blue-500 bg-slate-700 text-slate-100 rounded focus:ring-2 focus:ring-blue-500"
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
                              onChange={(e) => handleCategoriaInlineChange(producto, e.target.value)}
                              onBlur={() => saveEdit(producto)}
                              autoFocus
                              className="px-2 py-1 border border-blue-500 bg-slate-700 text-slate-100 rounded focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">Sin categoría</option>
                              {categorias.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                              <option value="__add__">+ Agregar categoría</option>
                            </select>
                          ) : (
                            <div 
                              className="text-sm text-slate-100 cursor-pointer hover:bg-slate-800 px-2 py-1 rounded"
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
                              className="w-20 px-2 py-1 border border-blue-500 bg-slate-700 text-slate-100 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <div 
                              className="text-sm font-semibold text-slate-100 cursor-pointer hover:bg-slate-800 px-2 py-1 rounded"
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
                              className="w-20 px-2 py-1 border border-blue-500 bg-slate-700 text-slate-100 rounded focus:ring-2 focus:ring-blue-500"
                            />
                          ) : (
                            <div 
                              className="text-sm text-slate-400 cursor-pointer hover:bg-slate-800 px-2 py-1 rounded"
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

                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
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
          <div className="lg:hidden divide-y divide-slate-700">
            {productosFiltrados.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                No hay productos para mostrar
              </div>
            ) : (
              productosFiltrados.map((producto) => {
                const tipoBadge = getTipoBadge(producto.tipo);
                const margen = calcularMargen(producto.precio, producto.costo);
                const isEditing = editingId === producto.id;

                return (
                  <div key={producto.id} className="p-4 hover:bg-slate-900">
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
                            className="w-full px-2 py-1 border border-blue-500 bg-slate-700 text-slate-100 rounded focus:ring-2 focus:ring-blue-500 text-base font-semibold"
                          />
                        ) : (
                          <div 
                            className="cursor-pointer hover:bg-slate-800 px-2 py-1 rounded -ml-2"
                            onClick={() => startEdit(producto.id, 'nombre', producto.nombre)}
                          >
                            <h3 className="font-semibold text-slate-100 flex items-center gap-2">
                              {producto.nombre}
                              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </h3>
                            {producto.descripcion && (
                              <p className="text-sm text-slate-400 mt-1">{producto.descripcion}</p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => saveEdit(producto)}
                              className="p-2 text-green-600 hover:bg-green-900/20 rounded-lg"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="p-2 text-red-600 hover:bg-red-900/20 rounded-lg"
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
                              className="p-2 text-blue-600 hover:bg-blue-900/20 rounded-lg"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleEliminar(producto)}
                              className="p-2 text-red-600 hover:bg-red-900/20 rounded-lg"
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
                        <label className="text-xs text-slate-400 block mb-1">Tipo</label>
                        {isEditing && editingField === 'tipo' ? (
                          <select
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => saveEdit(producto)}
                            autoFocus
                            className="w-full px-2 py-1 border border-blue-500 bg-slate-700 text-slate-100 rounded focus:ring-2 focus:ring-blue-500"
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
                        <label className="text-xs text-slate-400 block mb-1">Categoría</label>
                        {isEditing && editingField === 'categoria' ? (
                          <select
                            value={editingValue}
                            onChange={(e) => handleCategoriaInlineChange(producto, e.target.value)}
                            onBlur={() => saveEdit(producto)}
                            autoFocus
                            className="w-full px-2 py-1 border border-blue-500 bg-slate-700 text-slate-100 rounded focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Sin categoría</option>
                            {categorias.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                            <option value="__add__">+ Agregar categoría</option>
                          </select>
                        ) : (
                          <div 
                            className="text-slate-100 cursor-pointer hover:bg-slate-800 px-2 py-1 rounded -ml-2 flex items-center gap-1"
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
                        <label className="text-xs text-slate-400 block mb-1">Precio</label>
                        {isEditing && editingField === 'precio' ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, producto)}
                            onBlur={() => saveEdit(producto)}
                            autoFocus
                            className="w-full px-2 py-1 border border-blue-500 bg-slate-700 text-slate-100 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <div 
                            className="font-semibold text-slate-100 cursor-pointer hover:bg-slate-800 px-2 py-1 rounded -ml-2 flex items-center gap-1"
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
                        <label className="text-xs text-slate-400 block mb-1">Costo</label>
                        {isEditing && editingField === 'costo' ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onKeyDown={(e) => handleKeyDown(e, producto)}
                            onBlur={() => saveEdit(producto)}
                            autoFocus
                            className="w-full px-2 py-1 border border-blue-500 bg-slate-700 text-slate-100 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <div 
                            className="text-slate-400 cursor-pointer hover:bg-slate-800 px-2 py-1 rounded -ml-2 flex items-center gap-1"
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
                        <label className="text-xs text-slate-400 block mb-1">Margen</label>
                        <span className={`text-sm font-bold ${margen > 50 ? 'text-green-600' : margen > 30 ? 'text-blue-600' : 'text-orange-600'}`}>
                          {margen}%
                        </span>
                      </div>

                      {/* Proveedor */}
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">Proveedor</label>
                        <span className="text-slate-400">{producto.proveedor?.nombre || '-'}</span>
                      </div>
                    </div>

                    {/* Hint de edición */}
                    <div className="mt-3 pt-3 border-t border-slate-700">
                      <p className="text-xs text-slate-500 text-center flex items-center justify-center gap-1">
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
          <div className="bg-slate-800 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-slate-100 mb-4">
              {productoSeleccionado ? 'Editar Producto' : 'Nuevo Producto'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1">Nombre *</label>
                  <input
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1">Descripción</label>
                  <textarea
                    value={formData.descripcion}
                    onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-600 bg-slate-700 text-slate-100 placeholder-slate-400 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Precio *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.precio}
                    onChange={(e) => setFormData({ ...formData, precio: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-600 bg-slate-700 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Costo *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.costo}
                    onChange={(e) => setFormData({ ...formData, costo: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-600 bg-slate-700 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Categoría</label>
                  <select
                    value={formData.categoria}
                    onChange={(e) => handleCategoriaFormChange(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-600 bg-slate-700 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sin categoría</option>
                    {categorias.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="__add__">+ Agregar categoría</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Tipo *</label>
                  <select
                    value={formData.tipo}
                    onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-600 bg-slate-700 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {tipos.map(tipo => (
                      <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1">Proveedor</label>
                  <select
                    value={formData.proveedorId}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '__add__') {
                        setEditingProveedor(null);
                        setProveedorModalOpen(true);
                        return;
                      }
                      setFormData({ ...formData, proveedorId: value });
                    }}
                    className="w-full px-4 py-2 border border-slate-600 bg-slate-700 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sin proveedor</option>
                    {proveedores.map(prov => (
                      <option key={prov.id} value={prov.id}>{prov.nombre}</option>
                    ))}
                    <option value="__add__">+ Agregar proveedor</option>
                  </select>
                </div>

                {formData.precio && formData.costo && (
                  <div className="col-span-2 p-4 bg-blue-900/20 rounded-lg">
                    <p className="text-sm text-slate-400">Margen de ganancia:</p>
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
                  className="flex-1 px-4 py-2 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-900"
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

      {categoriaModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-slate-100 mb-4">
              {categoriaModalMode === 'create' ? 'Nueva Categoría' : 'Editar Categoría'}
            </h2>
            <form onSubmit={handleGuardarCategoria} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Nombre</label>
                <input
                  type="text"
                  value={categoriaNombre}
                  onChange={(e) => setCategoriaNombre(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-600 bg-slate-700 text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  maxLength={100}
                  required
                />
                <p className="text-xs text-slate-400 mt-2">
                  {categoriaModalMode === 'create'
                    ? 'Quedará disponible en los dropdowns de productos.'
                    : `Se actualizarán todos los productos con la categoría "${categoriaSeleccionada}".`}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeCategoriaModal}
                  className="flex-1 px-4 py-2 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-900"
                  disabled={categoriaSaving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  disabled={categoriaSaving}
                >
                  {categoriaSaving ? 'Guardando...' : (categoriaModalMode === 'create' ? 'Crear' : 'Actualizar')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ProveedorModal
        open={proveedorModalOpen}
        onClose={() => setProveedorModalOpen(false)}
        onSaved={async (saved) => {
          await cargarProveedores();
          if (saved?.id) {
            setFormData((prev) => ({ ...prev, proveedorId: saved.id }));
          }
        }}
        localId={effectiveLocalId}
        initialProveedor={editingProveedor}
      />
    </div>
  );
}

