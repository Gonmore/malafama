const { Usuario, Local } = require('../models');
const { generateToken } = require('../config/jwt');

// Registrar nuevo usuario
const register = async (req, res) => {
  try {
    const { nombre, email, password, tipo } = req.body;

    // Verificar si el email ya existe
    const usuarioExistente = await Usuario.findOne({ where: { email } });
    if (usuarioExistente) {
      return res.status(400).json({
        success: false,
        message: 'El email ya está registrado'
      });
    }

    // Crear usuario
    const usuario = await Usuario.create({
      nombre,
      email,
      password,
      tipo
    });

    // Generar token
    const token = generateToken({
      id: usuario.id,
      email: usuario.email,
      tipo: usuario.tipo
    });

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: {
        usuario,
        token
      }
    });
  } catch (error) {
    console.error('Error en register:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar usuario',
      error: error.message
    });
  }
};

// Login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Extra logging to help identify where login attempts come from (e.g., mobile device)
    const origin = req.get('origin') || req.get('host') || 'unknown';
    const userAgent = req.get('user-agent') || 'unknown';
    const clientIp = req.ip || req.connection?.remoteAddress || req.headers['x-forwarded-for'] || 'unknown';

    // Mask password when logging
    const maskedBody = {
      ...req.body,
      password: password ? `***len:${password.length}` : undefined,
    };

    console.log('🔑 Intento de login:', {
      email,
      tienePassword: !!password,
      passwordLength: password?.length,
      origin,
      userAgent,
      clientIp,
      body: maskedBody,
    });

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son requeridos'
      });
    }

    // Buscar usuario por email e incluir el local
    const usuario = await Usuario.findOne({ 
      where: { email },
      include: [{
        model: Local,
        as: 'local',
        attributes: ['id', 'nombre', 'logo', 'qr', 'direccion', 'telefono', 'moneda']
      }]
    });
    if (!usuario) {
      console.log('❌ Usuario no encontrado:', email);
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar si el usuario está activo
    if (!usuario.activo) {
      console.log('❌ Usuario inactivo:', email);
      return res.status(401).json({
        success: false,
        message: 'Usuario inactivo'
      });
    }

    // Verificar password
    const isPasswordValid = await usuario.comparePassword(password);
    console.log('🔐 Validación de password:', { email, valida: isPasswordValid });
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    console.log('✅ Login exitoso:', email);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Generar token
    const token = generateToken({
      id: usuario.id,
      email: usuario.email,
      tipo: usuario.tipo
    });

    // Include `user` in addition to `usuario` for a stable API response shape
    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        usuario,
        user: usuario,
        token
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error al iniciar sesión',
      error: error.message
    });
  }
};

// Obtener perfil del usuario autenticado
const getProfile = async (req, res) => {
  try {
    res.json({
      success: true,
      data: req.user
    });
  } catch (error) {
    console.error('Error en getProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener perfil',
      error: error.message
    });
  }
};

// Actualizar perfil
const updateProfile = async (req, res) => {
  try {
    const { nombre, email, password } = req.body;
    const usuario = req.user;

    // Verificar si el nuevo email ya existe
    if (email && email !== usuario.email) {
      const emailExistente = await Usuario.findOne({ where: { email } });
      if (emailExistente) {
        return res.status(400).json({
          success: false,
          message: 'El email ya está registrado'
        });
      }
    }

    // Actualizar campos
    if (nombre) usuario.nombre = nombre;
    if (email) usuario.email = email;
    if (password) usuario.password = password;

    await usuario.save();

    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      data: usuario
    });
  } catch (error) {
    console.error('Error en updateProfile:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil',
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  updateProfile
};
