const { Local, Mesa, Producto, Usuario, Tenant } = require('../models');

const { saveBase64ToUploads } = require('../services/storage.service');

// Extraer dominio de un email
const extraerDominioEmail = (email, nombreLocal = null) => {
  // Si hay un email válido con @, extraer el dominio
  if (email && typeof email === 'string' && email.includes('@')) {
    const partes = email.split('@');
    if (partes.length === 2 && partes[1] && partes[1].length > 0) {
      return partes[1]; // Ej: "malafama.com"
    }
  }
  
  // Si no hay dominio válido, usar el nombre del local
  if (nombreLocal) {
    return `${nombreLocal.toLowerCase().replace(/\s+/g, '')}.local`;
  }
  
  return 'local.com'; // Fallback final
};

// Generar email único para un rol
const generarEmailUnico = async (rol, dominio) => {
  let email = `${rol}@${dominio}`;
  let contador = 1;
  
  // Verificar si el email ya existe
  while (await Usuario.findOne({ where: { email } })) {
    email = `${rol}${contador}@${dominio}`;
    contador++;
  }
  
  return email;
};

// Crear un nuevo local (solo admin)
const crearLocal = async (req, res) => {
  try {
    const { nombre, descripcion, direccion, telefono, email, logo, qr } = req.body;
    const usuarioId = req.user.id;
    const adminEmail = req.user.email;

    // Validar que el usuario sea admin
    if (req.user.tipo !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        message: 'Solo los administradores pueden crear locales' 
      });
    }

    // Enforce tenant subscription / max locales if this admin is linked to a Tenant
    const tenant = await Tenant.findOne({ where: { adminUsuarioId: usuarioId, activo: true } });
    if (tenant) {
      const now = new Date();
      if (tenant.suscripcionHasta && new Date(tenant.suscripcionHasta) < now) {
        return res.status(403).json({
          success: false,
          message: 'Suscripción vencida. No puedes crear más locales.',
        });
      }

      const localesActuales = await Local.count({ where: { usuarioPropietarioId: usuarioId } });
      if (Number.isFinite(tenant.maxLocales) && localesActuales >= tenant.maxLocales) {
        return res.status(403).json({
          success: false,
          message: `Límite de locales alcanzado (${tenant.maxLocales}).`,
        });
      }
    }

    // If logo is base64/data URI, save to uploads and set logo_url
    const localData = {
      nombre,
      descripcion,
      direccion,
      telefono,
      email,
      qr,
      usuarioPropietarioId: usuarioId,
      plan: tenant?.planDefault || 'gratuito',
      moneda: tenant?.monedaDefault || undefined
    };

    if (logo && typeof logo === 'string') {
      try {
        if (/^data:/i.test(logo) || /^[A-Za-z0-9+/=\s]+$/.test(logo)) {
          const publicPath = await saveBase64ToUploads(logo, 'local');
          localData.logoUrl = publicPath;
          localData.logo = null;
        } else {
          localData.logo = logo;
        }
      } catch (err) {
        console.warn('Failed saving local logo to uploads', err.message || err);
        localData.logo = logo;
      }
    }

    // Crear local
    const local = await Local.create(localData);

    // Crear usuarios automáticos para el local
    const passwordDefault = 'password123'; // Password por defecto
    const dominio = extraerDominioEmail(adminEmail, nombre); // Extraer dominio del admin, fallback a nombre del local

    const usuariosCreados = [];

    // 1. Crear usuario Mesero (Atención)
    const emailMesero = await generarEmailUnico('mesero', dominio);
    const mesero = await Usuario.create({
      nombre: `Mesero - ${nombre}`,
      email: emailMesero,
      password: passwordDefault,
      tipo: 'atencion',
      localId: local.id,
      activo: true,
      onboarding_completado: true
    });
    console.log('👤 Usuario creado:', mesero.email, 'con contraseña por defecto', passwordDefault);
    usuariosCreados.push({ tipo: 'mesero', ...mesero.toJSON() });

    // 2. Crear usuario Cocina
    const emailCocina = await generarEmailUnico('cocina', dominio);
    const cocina = await Usuario.create({
      nombre: `Cocina - ${nombre}`,
      email: emailCocina,
      password: passwordDefault,
      tipo: 'cocina',
      rolCocina: 'cocina',
      localId: local.id,
      activo: true,
      onboarding_completado: true
    });
    console.log('👤 Usuario creado:', cocina.email, 'con contraseña por defecto', passwordDefault);
    usuariosCreados.push({ tipo: 'cocina', ...cocina.toJSON() });

    // 3. Crear usuario Bar
    const emailBar = await generarEmailUnico('bar', dominio);
    const bar = await Usuario.create({
      nombre: `Bar - ${nombre}`,
      email: emailBar,
      password: passwordDefault,
      tipo: 'bar',
      rolCocina: 'bar',
      localId: local.id,
      activo: true,
      onboarding_completado: true
    });
    console.log('👤 Usuario creado:', bar.email, 'con contraseña por defecto', passwordDefault);
    usuariosCreados.push({ tipo: 'bar', ...bar.toJSON() });

    res.status(201).json({
      success: true,
      message: 'Local creado exitosamente',
      data: {
        local: local,
        usuarios: usuariosCreados,
        credenciales: {
          passwordPorDefecto: passwordDefault,
          mensaje: 'Guarda estas credenciales. Los usuarios pueden cambiar su contraseña después.'
        }
      }
    });
  } catch (error) {
    console.error('Error al crear local:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al crear local',
      error: error.message 
    });
  }
};

// Obtener todos los locales del usuario (admin propietario)
const obtenerLocales = async (req, res) => {
  try {
    const usuarioId = req.user.id;
    
    const locales = await Local.findAll({
      where: { usuarioPropietarioId: usuarioId },
      order: [['created_at', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        locales: locales
      }
    });
  } catch (error) {
    console.error('Error al obtener locales:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener locales',
      error: error.message 
    });
  }
};

// Obtener un local específico por ID
const obtenerLocalPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;

    const local = await Local.findOne({
      where: { 
        id,
        usuarioPropietarioId: usuarioId 
      },
      include: [
        {
          model: Mesa,
          as: 'mesas'
        },
        {
          model: Producto,
          as: 'productos'
        },
        {
          model: Usuario,
          as: 'empleados',
          attributes: ['id', 'nombre', 'email', 'tipo', 'rolCocina']
        }
      ]
    });

    if (!local) {
      return res.status(404).json({ 
        success: false, 
        message: 'Local no encontrado' 
      });
    }

    res.json({
      success: true,
      data: local
    });
  } catch (error) {
    console.error('Error al obtener local:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al obtener local',
      error: error.message 
    });
  }
};

// Obtener logo del local al que pertenece el usuario autenticado
const obtenerLogoLocal = async (req, res) => {
  try {
    const localId = req.user.localId;

    if (!localId) {
      return res.status(400).json({ success: false, message: 'El usuario no está asociado a un local' });
    }

    const local = await Local.findByPk(localId, { attributes: ['id', 'logo', 'logo_url'] });

    if (!local) {
      return res.status(404).json({ success: false, message: 'Local no encontrado' });
    }

    // Prefer logo_url if available (public URL), otherwise return inline logo field
    const logoValue = local.logo_url || local.logo || null;

    res.json({ success: true, data: { id: local.id, logo: logoValue } });
  } catch (error) {
    console.error('Error al obtener logo del local:', error);
    res.status(500).json({ success: false, message: 'Error al obtener logo del local', error: error.message });
  }
};

// Actualizar local
const actualizarLocal = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, direccion, telefono, email, logo, moneda, qr } = req.body;
    const usuarioId = req.user.id;

    const local = await Local.findOne({
      where: { 
        id,
        usuarioPropietarioId: usuarioId 
      }
    });

    if (!local) {
      return res.status(404).json({ 
        success: false, 
        message: 'Local no encontrado' 
      });
    }

    // Handle logo if provided (base64 or URL)
    const updates = {
      nombre,
      descripcion,
      direccion,
      telefono,
      email,
      qr,
      moneda
    };

    if (logo !== undefined) {
      try {
        if (logo && typeof logo === 'string' && (/^data:/i.test(logo) || /^[A-Za-z0-9+/=\s]+$/.test(logo))) {
          const publicPath = await saveBase64ToUploads(logo, 'local');
          updates.logoUrl = publicPath;
          updates.logo = null;
        } else {
          updates.logo = logo;
        }
      } catch (err) {
        console.warn('Failed saving updated local logo to uploads', err.message || err);
        updates.logo = logo;
      }
    }

    await local.update(updates);

    res.json({
      success: true,
      message: 'Local actualizado exitosamente',
      data: local
    });
  } catch (error) {
    console.error('Error al actualizar local:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al actualizar local',
      error: error.message 
    });
  }
};

// Eliminar local
const eliminarLocal = async (req, res) => {
  try {
    const { id } = req.params;
    const usuarioId = req.user.id;

    const local = await Local.findOne({
      where: { 
        id,
        usuarioPropietarioId: usuarioId 
      }
    });

    if (!local) {
      return res.status(404).json({ 
        success: false, 
        message: 'Local no encontrado' 
      });
    }

    await local.destroy();

    res.json({
      success: true,
      message: 'Local eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar local:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al eliminar local',
      error: error.message 
    });
  }
};

module.exports = {
  crearLocal,
  obtenerLocales,
  obtenerLocalPorId,
  obtenerLogoLocal,
  actualizarLocal,
  eliminarLocal
};
