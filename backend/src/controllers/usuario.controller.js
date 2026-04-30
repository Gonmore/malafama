const { Usuario } = require('../models');
const { Op } = require('sequelize');
const { resolveAllowedLocalIds, assertLocalIdAllowed } = require('../utils/localScope');

function isUsuarioInScope(usuario, allowedLocalIds, currentUserId) {
  if (allowedLocalIds === null) return true;
  if (!usuario) return false;
  if (usuario.id === currentUserId) return true;
  const uLocalId = usuario.localId;
  return Boolean(uLocalId && allowedLocalIds.includes(uLocalId));
}

// Obtener todos los usuarios
const getAllUsuarios = async (req, res) => {
  try {
    const { tipo, activo, search } = req.query;

    const allowedLocalIds = await resolveAllowedLocalIds(req);

    const baseWhere = {};
    if (tipo) baseWhere.tipo = tipo;
    if (activo !== undefined) baseWhere.activo = activo === 'true';

    const andClauses = [baseWhere];

    if (search) {
      andClauses.push({
        [Op.or]: [
          { nombre: { [Op.iLike]: `%${search}%` } },
          { email: { [Op.iLike]: `%${search}%` } }
        ]
      });
    }

    // Scope por tenant (admin): usuarios de los locales del admin + el propio admin.
    if (allowedLocalIds !== null) {
      andClauses.push({
        [Op.or]: [
          { id: req.user.id },
          { localId: { [Op.in]: allowedLocalIds } }
        ]
      });
    }

    const where = andClauses.length === 1 ? baseWhere : { [Op.and]: andClauses };

    const usuarios = await Usuario.findAll({
      where,
      order: [['nombre', 'ASC']]
    });

    // Incluir indicador de si usa password por defecto (para que admin lo vea)
    const usuariosConInfo = usuarios.map(u => {
      const usuarioJson = u.toJSON();
      delete usuarioJson.password; // No enviar el hash
      // Indicar si probablemente usa password por defecto
      usuarioJson.passwordDefault = u.onboarding_completado ? 'password123' : null; // Solo mostrar para usuarios creados por onboarding
      return usuarioJson;
    });

    res.json({
      success: true,
      data: usuariosConInfo
    });
  } catch (error) {
    console.error('Error en getAllUsuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios',
      error: error.message
    });
  }
};

// Obtener usuario por ID
const getUsuarioById = async (req, res) => {
  try {
    const { id } = req.params;

    const allowedLocalIds = await resolveAllowedLocalIds(req);

    const usuario = await Usuario.findByPk(id, {
      attributes: { exclude: ['password'] }
    });

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (req.user.tipo === 'admin' && !isUsuarioInScope(usuario, allowedLocalIds, req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para acceder a este usuario'
      });
    }

    res.json({
      success: true,
      data: usuario
    });
  } catch (error) {
    console.error('Error en getUsuarioById:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuario',
      error: error.message
    });
  }
};

// Crear usuario (solo admin)
const { saveBase64ToUploads } = require('../services/storage.service');

const createUsuario = async (req, res) => {
  try {
    const { nombre, email, password, tipo, telefono, direccion, foto, localId: requestedLocalId } = req.body;

    // Verificar que el email no esté en uso
    const usuarioExistente = await Usuario.findOne({ where: { email } });
    if (usuarioExistente) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }

    // Validar tipo de usuario
    const tiposValidos = ['admin', 'atencion', 'supervisor', 'cocina', 'bar'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de usuario inválido',
        tiposValidos
      });
    }

    const allowedLocalIds = await resolveAllowedLocalIds(req);
    const tiposOperativos = ['atencion', 'supervisor', 'cocina', 'bar'];

    // Para usuarios operativos, usar el local seleccionado o el único local permitido del admin.
    let localId = null;
    if (tiposOperativos.includes(tipo)) {
      const fallbackLocalId = req.user.localId || (Array.isArray(allowedLocalIds) && allowedLocalIds.length === 1 ? allowedLocalIds[0] : null);
      localId = requestedLocalId || fallbackLocalId;

      if (!localId) {
        return res.status(400).json({
          success: false,
          message: 'Debes seleccionar un local para este tipo de usuario'
        });
      }

      assertLocalIdAllowed(allowedLocalIds, localId);
    }

    const usuarioData = {
      nombre,
      email,
      password: password || 'password123', // Password por defecto si no se proporciona
      tipo,
      telefono,
      direccion,
      localId
    };

    // If foto is a base64/data URI, save to uploads and set foto_url
    if (foto && typeof foto === 'string') {
      try {
        if (/^data:/i.test(foto) || /^[A-Za-z0-9+/=\s]+$/.test(foto)) {
          const publicPath = await saveBase64ToUploads(foto, 'user');
          usuarioData.fotoUrl = publicPath;
          usuarioData.foto = null;
        } else {
          // Assume a URL or URI string
          usuarioData.foto = foto;
        }
      } catch (err) {
        console.warn('Failed saving user foto to uploads', err.message || err);
        usuarioData.foto = foto;
      }
    }

    const usuario = await Usuario.create(usuarioData);

    // Excluir password de la respuesta
    const usuarioResponse = usuario.toJSON();
    delete usuarioResponse.password;

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: usuarioResponse
    });
  } catch (error) {
    console.error('Error en createUsuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear usuario',
      error: error.message
    });
  }
};

// Actualizar usuario
const updateUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, email, telefono, direccion, tipo, activo, foto } = req.body;

    const allowedLocalIds = await resolveAllowedLocalIds(req);

    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Evitar que un admin edite usuarios de otros tenants
    if (req.user.tipo === 'admin' && !isUsuarioInScope(usuario, allowedLocalIds, req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para modificar este usuario'
      });
    }

    // Si se está actualizando el email, verificar que no esté en uso
    if (email && email !== usuario.email) {
      const emailEnUso = await Usuario.findOne({ where: { email } });
      if (emailEnUso) {
        return res.status(400).json({
          success: false,
          message: 'El email ya está registrado'
        });
      }
    }

    // Solo admin puede cambiar tipo
    if (tipo && req.user.tipo !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para cambiar el tipo de usuario'
      });
    }

    const updates = {
      nombre: nombre || usuario.nombre,
      email: email || usuario.email,
      telefono: telefono !== undefined ? telefono : usuario.telefono,
      direccion: direccion !== undefined ? direccion : usuario.direccion,
      tipo: tipo || usuario.tipo,
      activo: activo !== undefined ? activo : usuario.activo
    };

    if (foto !== undefined) {
      try {
        if (foto && typeof foto === 'string' && (/^data:/i.test(foto) || /^[A-Za-z0-9+/=\s]+$/.test(foto))) {
          const publicPath = await saveBase64ToUploads(foto, 'user');
          updates.fotoUrl = publicPath;
          updates.foto = null;
        } else {
          updates.foto = foto;
        }
      } catch (err) {
        console.warn('Failed saving updated user foto to uploads', err.message || err);
        updates.foto = foto;
      }
    }

    await usuario.update(updates);

    const usuarioResponse = usuario.toJSON();
    delete usuarioResponse.password;

    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: usuarioResponse
    });
  } catch (error) {
    console.error('Error en updateUsuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar usuario',
      error: error.message
    });
  }
};

// Eliminar usuario (soft delete)
const deleteUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    const allowedLocalIds = await resolveAllowedLocalIds(req);

    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (!isUsuarioInScope(usuario, allowedLocalIds, req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para eliminar este usuario'
      });
    }

    // No permitir eliminar el propio usuario
    if (usuario.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'No puedes eliminar tu propio usuario'
      });
    }

    // No permitir eliminar el único admin
    if (usuario.tipo === 'admin') {
      const adminCountWhere = {
        tipo: 'admin',
        activo: true,
      };
      if (allowedLocalIds !== null) {
        adminCountWhere[Op.or] = [
          { id: req.user.id },
          { localId: { [Op.in]: allowedLocalIds } }
        ];
      }
      const adminCount = await Usuario.count({ where: adminCountWhere });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'No se puede desactivar el único administrador del sistema'
        });
      }
    }

    await usuario.update({ activo: false });

    res.json({
      success: true,
      message: 'Usuario desactivado exitosamente'
    });
  } catch (error) {
    console.error('Error en deleteUsuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar usuario',
      error: error.message
    });
  }
};

// Obtener usuarios por tipo
const getUsersByTipo = async (req, res) => {
  try {
    const { tipo } = req.params;

    const allowedLocalIds = await resolveAllowedLocalIds(req);

    const tiposValidos = ['admin', 'atencion', 'supervisor', 'cocina', 'bar', 'proveedor'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de usuario inválido',
        tiposValidos
      });
    }

    const where = {
      tipo,
      activo: true
    };

    if (allowedLocalIds !== null) {
      where[Op.or] = [
        { id: req.user.id },
        { localId: { [Op.in]: allowedLocalIds } }
      ];
    }

    const usuarios = await Usuario.findAll({
      where,
      attributes: { exclude: ['password'] },
      order: [['nombre', 'ASC']]
    });

    res.json({
      success: true,
      data: usuarios
    });
  } catch (error) {
    console.error('Error en getUsersByTipo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios',
      error: error.message
    });
  }
};

// Activar usuario
const activarUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    const allowedLocalIds = await resolveAllowedLocalIds(req);

    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (!isUsuarioInScope(usuario, allowedLocalIds, req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para activar este usuario'
      });
    }

    await usuario.update({ activo: true });

    const usuarioResponse = usuario.toJSON();
    delete usuarioResponse.password;

    res.json({
      success: true,
      message: 'Usuario activado exitosamente',
      data: usuarioResponse
    });
  } catch (error) {
    console.error('Error en activarUsuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al activar usuario',
      error: error.message
    });
  }
};

// Desactivar usuario
const desactivarUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    const allowedLocalIds = await resolveAllowedLocalIds(req);

    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (!isUsuarioInScope(usuario, allowedLocalIds, req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para desactivar este usuario'
      });
    }

    // No permitir desactivar el propio usuario
    if (usuario.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'No puedes desactivar tu propio usuario'
      });
    }

    // No permitir desactivar el único admin
    if (usuario.tipo === 'admin') {
      const adminCountWhere = {
        tipo: 'admin',
        activo: true,
      };
      if (allowedLocalIds !== null) {
        adminCountWhere[Op.or] = [
          { id: req.user.id },
          { localId: { [Op.in]: allowedLocalIds } }
        ];
      }
      const adminCount = await Usuario.count({ where: adminCountWhere });
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'No se puede desactivar el único administrador del sistema'
        });
      }
    }

    await usuario.update({ activo: false });

    const usuarioResponse = usuario.toJSON();
    delete usuarioResponse.password;

    res.json({
      success: true,
      message: 'Usuario desactivado exitosamente',
      data: usuarioResponse
    });
  } catch (error) {
    console.error('Error en desactivarUsuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al desactivar usuario',
      error: error.message
    });
  }
};

// Resetear contraseña a valor por defecto (solo admin)
const resetPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const allowedLocalIds = await resolveAllowedLocalIds(req);
    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    if (!isUsuarioInScope(usuario, allowedLocalIds, req.user.id)) {
      return res.status(403).json({ success: false, message: 'No tienes permisos para resetear esta contraseña' });
    }

    // Generar contraseña por defecto (en producción debería venir de env)
    const passwordPorDefecto = 'password123';

    await usuario.update({ password: passwordPorDefecto });

    console.log('🔁 Contraseña reseteada para:', usuario.email);

    res.json({
      success: true,
      message: 'Contraseña reseteada',
      data: { passwordPorDefecto }
    });
  } catch (error) {
    console.error('Error en resetPassword:', error);
    res.status(500).json({ success: false, message: 'Error al resetear contraseña', error: error.message });
  }
};

// Cambiar contraseña
const cambiarPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { passwordActual, passwordNueva } = req.body;

    const allowedLocalIds = await resolveAllowedLocalIds(req);

    console.log('🔐 Cambiar contraseña:', { 
      usuarioId: id, 
      tienePasswordActual: !!passwordActual, 
      tienePasswordNueva: !!passwordNueva,
      adminRequest: req.user.tipo === 'admin'
    });

    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (req.user.tipo === 'admin' && !isUsuarioInScope(usuario, allowedLocalIds, req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para cambiar esta contraseña'
      });
    }

    // Solo el mismo usuario o un admin pueden cambiar la contraseña
    if (req.user.id !== usuario.id && req.user.tipo !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para cambiar esta contraseña'
      });
    }

    // Si no es admin, debe proporcionar la contraseña actual
    if (req.user.tipo !== 'admin') {
      if (!passwordActual) {
        return res.status(400).json({
          success: false,
          message: 'Debes proporcionar la contraseña actual'
        });
      }
      const passwordValida = await usuario.comparePassword(passwordActual);
      if (!passwordValida) {
        return res.status(401).json({
          success: false,
          message: 'Contraseña actual incorrecta'
        });
      }
    }

    if (!passwordNueva || passwordNueva.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe tener al menos 6 caracteres'
      });
    }

    await usuario.update({ password: passwordNueva });

    console.log('✅ Contraseña actualizada para usuario:', usuario.email);

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error en cambiarPassword:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar contraseña',
      error: error.message
    });
  }
};

module.exports = {
  getAllUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  getUsersByTipo,
  activarUsuario,
  desactivarUsuario,
  cambiarPassword
  ,resetPassword
};
