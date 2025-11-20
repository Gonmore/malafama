import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import userService from '../../services/userService';
import localService from '../../services/localService';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function UsuariosManagement() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [usuarios, setUsuarios] = useState([]);
  const [locales, setLocales] = useState([]);
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [showModal, setShowModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    email: '',
    tipo: 'atencion',
    password: '',
    localId: ''
  });
  const [passwordData, setPasswordData] = useState({
    nuevaPassword: '',
    confirmarPassword: ''
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const [usuariosRes, localesRes] = await Promise.all([
        userService.getAll(),
        localService.obtenerLocales()
      ]);
      
      const dataUsuarios = usuariosRes.data?.usuarios || usuariosRes.data || [];
      const dataLocales = localesRes.data?.locales || localesRes.data || [];
      
      setUsuarios(dataUsuarios);
      setLocales(dataLocales);
    } catch (error) {
      console.error('Error al cargar datos:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      const response = await userService.getAll();
      const data = response.data?.usuarios || response.data || [];
      setUsuarios(data);
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.nombre || !formData.email) {
      toast.error('Completa todos los campos requeridos');
      return;
    }

    try {
      if (usuarioSeleccionado) {
        // Actualizar
        await userService.update(usuarioSeleccionado.id, {
          nombre: formData.nombre,
          email: formData.email,
          tipo: formData.tipo,
          localId: formData.localId || null
        });
        toast.success('Usuario actualizado correctamente');
      } else {
        // Crear - Si no hay password, el backend usará password123 por defecto
        await userService.create(formData);
        toast.success('Usuario creado correctamente');
      }
      
      setShowModal(false);
      resetForm();
      cargarUsuarios();
    } catch (error) {
      console.error('Error al guardar usuario:', error);
      toast.error(error.response?.data?.message || 'Error al guardar usuario');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (passwordData.nuevaPassword !== passwordData.confirmarPassword) {
      toast.error('Las contraseñas no coinciden');
      return;
    }

    if (passwordData.nuevaPassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      console.log('🔐 Cambiando contraseña para usuario:', usuarioSeleccionado.id);
      const response = await userService.changePassword(usuarioSeleccionado.id, {
        passwordNueva: passwordData.nuevaPassword
      });
      console.log('✅ Respuesta:', response);
      toast.success('Contraseña actualizada correctamente');
      setShowPasswordModal(false);
      setPasswordData({ nuevaPassword: '', confirmarPassword: '' });
    } catch (error) {
      console.error('❌ Error al cambiar contraseña:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Error al cambiar contraseña';
      toast.error(errorMsg);
    }
  };

  const handleActivarDesactivar = async (usuario) => {
    try {
      if (usuario.activo) {
        await userService.desactivar(usuario.id);
        toast.success('Usuario desactivado');
      } else {
        await userService.activar(usuario.id);
        toast.success('Usuario activado');
      }
      cargarUsuarios();
    } catch (error) {
      console.error('Error al cambiar estado:', error);
      toast.error('Error al cambiar estado del usuario');
    }
  };

  const handleEliminar = async (usuario) => {
    if (!confirm(`¿Estás seguro de eliminar al usuario ${usuario.nombre}?`)) {
      return;
    }

    try {
      await userService.delete(usuario.id);
      toast.success('Usuario eliminado');
      cargarUsuarios();
    } catch (error) {
      console.error('Error al eliminar usuario:', error);
      toast.error('Error al eliminar usuario');
    }
  };

  const handleResetPassword = async (usuario) => {
    if (!confirm(`¿Resetear contraseña de ${usuario.nombre} a password por defecto?`)) return;

    try {
      const response = await userService.resetPassword(usuario.id);
      const passwordPorDefecto = response?.data?.passwordPorDefecto || 'password123';
      toast.success(`✅ Contraseña reseteada: ${passwordPorDefecto}`);
      cargarUsuarios();
    } catch (error) {
      console.error('Error al resetear contraseña:', error);
      toast.error(error.response?.data?.message || 'Error al resetear contraseña');
    }
  };

  const openEditModal = (usuario) => {
    setUsuarioSeleccionado(usuario);
    setFormData({
      nombre: usuario.nombre,
      email: usuario.email,
      tipo: usuario.tipo,
      password: '',
      localId: usuario.localId || ''
    });
    setShowModal(true);
  };

  const openNewModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openPasswordModal = (usuario) => {
    setUsuarioSeleccionado(usuario);
    setPasswordData({ nuevaPassword: '', confirmarPassword: '' });
    setShowPasswordModal(true);
  };

  const resetForm = () => {
    setUsuarioSeleccionado(null);
    setFormData({
      nombre: '',
      email: '',
      tipo: 'atencion',
      password: '',
      localId: ''
    });
  };

  const usuariosFiltrados = filtroTipo === 'todos' 
    ? usuarios 
    : usuarios.filter(u => u.tipo === filtroTipo);

  const getTipoBadge = (tipo) => {
    const badges = {
      admin: 'bg-red-100 text-red-800',
      atencion: 'bg-blue-100 text-blue-800',
      cocina: 'bg-green-100 text-green-800',
      bar: 'bg-orange-100 text-orange-800',
      proveedor: 'bg-purple-100 text-purple-800'
    };
    return badges[tipo] || 'bg-gray-100 text-gray-800';
  };

  const getTipoLabel = (tipo) => {
    const labels = {
      admin: 'Administrador',
      atencion: 'Mesero',
      cocina: 'Cocina',
      bar: 'Bar',
      proveedor: 'Proveedor'
    };
    return labels[tipo] || tipo;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner text="Cargando usuarios..." />
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
              <h1 className="text-3xl font-bold text-gray-900">👥 Gestión de Usuarios</h1>
              <p className="text-gray-600 mt-1">Administra meseros, cocina y usuarios del sistema</p>
            </div>
            <button
              onClick={openNewModal}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Nuevo Usuario
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Filtrar por tipo:</label>
            <div className="flex gap-2">
              <button
                onClick={() => setFiltroTipo('todos')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filtroTipo === 'todos'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Todos ({usuarios.length})
              </button>
              <button
                onClick={() => setFiltroTipo('atencion')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filtroTipo === 'atencion'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Meseros ({usuarios.filter(u => u.tipo === 'atencion').length})
              </button>
              <button
                onClick={() => setFiltroTipo('cocina')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filtroTipo === 'cocina'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Cocina ({usuarios.filter(u => u.tipo === 'cocina').length})
              </button>
              <button
                onClick={() => setFiltroTipo('bar')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filtroTipo === 'bar'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Bar ({usuarios.filter(u => u.tipo === 'bar').length})
              </button>
              <button
                onClick={() => setFiltroTipo('admin')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  filtroTipo === 'admin'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Admins ({usuarios.filter(u => u.tipo === 'admin').length})
              </button>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usuario
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Tipo
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Password
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Local
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider sticky right-0 bg-gray-50">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                    No hay usuarios para mostrar
                  </td>
                </tr>
              ) : (
                usuariosFiltrados.map((usuario) => {
                  const localUsuario = locales.find(l => l.id === usuario.localId);
                  return (
                  <tr key={usuario.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                          {usuario.nombre?.charAt(0).toUpperCase()}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{usuario.nombre}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{usuario.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTipoBadge(usuario.tipo)}`}>
                        {getTipoLabel(usuario.tipo)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {usuario.passwordDefault ? (
                        <div className="flex items-center gap-2">
                          <code className="px-2 py-1 bg-yellow-50 text-yellow-800 border border-yellow-200 rounded text-xs font-mono">
                            {usuario.passwordDefault}
                          </code>
                          <span className="text-xs text-gray-500" title="Password por defecto">
                            ⚠️
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">●●●●●●</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {localUsuario ? (
                        <div className="text-sm text-gray-900">
                          <span className="font-medium">{localUsuario.nombre}</span>
                          <p className="text-xs text-gray-500">{localUsuario.direccion}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Sin local asignado</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        usuario.activo 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {usuario.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap sticky right-0 bg-white">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditModal(usuario)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar usuario"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => openPasswordModal(usuario)}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Cambiar contraseña"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleResetPassword(usuario)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Resetear contraseña (password123)"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v6h6M20 20v-6h-6" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 8a8 8 0 10-8 8" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleActivarDesactivar(usuario)}
                          className={`p-2 rounded-lg transition-colors ${
                            usuario.activo 
                              ? 'text-orange-600 hover:bg-orange-50' 
                              : 'text-green-600 hover:bg-green-50'
                          }`}
                          title={usuario.activo ? 'Desactivar usuario' : 'Activar usuario'}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {usuario.activo ? (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            )}
                          </svg>
                        </button>
                        <button
                          onClick={() => handleEliminar(usuario)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar usuario"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
      </main>

      {/* Modal Crear/Editar Usuario */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              {usuarioSeleccionado ? 'Editar Usuario' : 'Nuevo Usuario'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tipo de Usuario *
                </label>
                <select
                  value={formData.tipo}
                  onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="atencion">Mesero</option>
                  <option value="cocina">Cocina</option>
                  <option value="bar">Bar</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              {/* Selector de Local - Solo para meseros, cocina y bar */}
              {(formData.tipo === 'atencion' || formData.tipo === 'cocina' || formData.tipo === 'bar') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Local * <span className="text-xs text-gray-500">(requerido para meseros, cocina y bar)</span>
                  </label>
                  <select
                    value={formData.localId}
                    onChange={(e) => setFormData({ ...formData, localId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Seleccionar local...</option>
                    {locales.map(local => (
                      <option key={local.id} value={local.id}>
                        {local.nombre} - {local.direccion}
                      </option>
                    ))}
                  </select>
                  {locales.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      ⚠️ No hay locales creados. Crea un local primero.
                    </p>
                  )}
                </div>
              )}

              {!usuarioSeleccionado && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contraseña (opcional - por defecto: password123)
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="password123"
                    minLength={6}
                  />
                  <p className="text-xs text-gray-500 mt-1">Deja vacío para usar: password123</p>
                </div>
              )}

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
                  {usuarioSeleccionado ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cambiar Contraseña */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Cambiar Contraseña
            </h2>
            <p className="text-gray-600 mb-4">
              Usuario: <strong>{usuarioSeleccionado?.nombre}</strong>
            </p>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nueva Contraseña *
                </label>
                <input
                  type="password"
                  value={passwordData.nuevaPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, nuevaPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirmar Contraseña *
                </label>
                <input
                  type="password"
                  value={passwordData.confirmarPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmarPassword: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  minLength={6}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordData({ nuevaPassword: '', confirmarPassword: '' });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Cambiar Contraseña
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
