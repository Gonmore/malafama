const { Usuario } = require('../models');
const { Op } = require('sequelize');

// Obtener todos los usuarios
const getAllUsuarios = async (req, res) => {
  try {
    const { tipo, activo, search } = req.query;

    const where = {};
    if (tipo) where.tipo = tipo;
    if (activo !== undefined) where.activo = activo === 'true';
    
    if (search) {
      where[Op.or] = [
        { nombre: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }

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

    const usuario = await Usuario.findByPk(id, {
      attributes: { exclude: ['password'] }
    });

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
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
const createUsuario = async (req, res) => {
  try {
    const { nombre, email, password, tipo, telefono, direccion } = req.body;

    // Verificar que el email no esté en uso
    const usuarioExistente = await Usuario.findOne({ where: { email } });
    if (usuarioExistente) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }

    // Validar tipo de usuario
    const tiposValidos = ['admin', 'atencion', 'cocina', 'bar'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de usuario inválido',
        tiposValidos
      });
    }

    // Para usuarios no-admin, requiere localId (se asigna el local del admin que crea)
    let localId = null;
    if (tipo !== 'admin' && req.user.localId) {
      localId = req.user.localId;
    }

    const usuario = await Usuario.create({
      nombre,
      email,
      password: password || 'password123', // Password por defecto si no se proporciona
      tipo,
      telefono,
      direccion,
      localId
    });

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
    const { nombre, email, telefono, direccion, tipo, activo } = req.body;

    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
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

    await usuario.update({
      nombre: nombre || usuario.nombre,
      email: email || usuario.email,
      telefono: telefono !== undefined ? telefono : usuario.telefono,
      direccion: direccion !== undefined ? direccion : usuario.direccion,
      tipo: tipo || usuario.tipo,
      activo: activo !== undefined ? activo : usuario.activo
    });

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

    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
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
      const adminCount = await Usuario.count({ where: { tipo: 'admin', activo: true } });
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

    const tiposValidos = ['admin', 'atencion', 'cocina', 'proveedor'];
    if (!tiposValidos.includes(tipo)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de usuario inválido',
        tiposValidos
      });
    }

    const usuarios = await Usuario.findAll({
      where: {
        tipo,
        activo: true
      },
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

    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
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

    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
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
      const adminCount = await Usuario.count({ where: { tipo: 'admin', activo: true } });
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
    const usuario = await Usuario.findByPk(id);

    if (!usuario) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
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
