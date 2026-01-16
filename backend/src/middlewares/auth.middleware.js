const { verifyToken } = require('../config/jwt');
const { Usuario, Local } = require('../models');

// Middleware para verificar si el usuario está autenticado
const authenticate = async (req, res, next) => {
  try {
    // Obtener token del header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No se proporcionó token de autenticación'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verificar token
    const decoded = verifyToken(token);

    // Buscar usuario en la base de datos e incluir el local
    const usuario = await Usuario.findByPk(decoded.id, {
      include: [{
        model: Local,
        as: 'local',
        attributes: ['id', 'nombre', 'logo', 'qr', 'direccion', 'telefono', 'moneda']
      }]
    });

    if (!usuario) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (!usuario.activo) {
      return res.status(401).json({
        success: false,
        message: 'Usuario inactivo'
      });
    }

    // Agregar usuario al request
    req.user = usuario;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token inválido o expirado'
    });
  }
};

// Middleware para verificar roles específicos
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado'
      });
    }

    if (!roles.includes(req.user.tipo)) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para acceder a este recurso'
      });
    }

    next();
  };
};

// Middleware para verificar si es el propio usuario o admin
const authorizeOwnerOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Usuario no autenticado'
    });
  }

  const userId = req.params.id || req.params.userId;
  
  if (req.user.tipo === 'admin' || req.user.id === userId) {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'No tienes permisos para acceder a este recurso'
    });
  }
};

module.exports = {
  authenticate,
  authorize,
  authorizeOwnerOrAdmin
};
