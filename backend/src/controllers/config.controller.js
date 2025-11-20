const { ConfiguracionRestaurante, Usuario, Mesa, Proveedor } = require('../models');
const { sequelize } = require('../config/database');

// Obtener configuración del restaurante
const getConfiguracion = async (req, res) => {
  try {
    const config = await ConfiguracionRestaurante.findOne({
      include: [{
        model: Usuario,
        as: 'admin',
        attributes: ['id', 'nombre', 'email']
      }]
    });

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'No se ha configurado el restaurante aún'
      });
    }

    // Contar mesas creadas
    const mesasCreadas = await Mesa.count();
    
    // Contar productos
    const { Producto } = require('../models');
    const productosTotal = await Producto.count();
    const productosConProveedor = await Producto.count({
      where: { proveedorId: { [require('sequelize').Op.ne]: null } }
    });

    res.json({
      success: true,
      data: {
        ...config.toJSON(),
        progreso: {
          mesasCreadas,
          mesasRequeridas: config.cantidadMesas,
          productosTotal,
          productosConProveedor,
          porcentajeCompletado: calcularProgreso(config, mesasCreadas, productosConProveedor)
        }
      }
    });
  } catch (error) {
    console.error('Error en getConfiguracion:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener configuración',
      error: error.message
    });
  }
};

// Crear configuración inicial
const createConfiguracion = async (req, res) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { nombreRestaurante, cantidadMesas, menuUrl } = req.body;
    const adminId = req.user.id;

    // Verificar que no exista configuración previa
    const existente = await ConfiguracionRestaurante.findOne();
    if (existente) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Ya existe una configuración para este restaurante'
      });
    }

    // Verificar que el usuario es admin
    if (req.user.tipo !== 'admin') {
      await transaction.rollback();
      return res.status(403).json({
        success: false,
        message: 'Solo administradores pueden crear la configuración'
      });
    }

    // Crear configuración
    const config = await ConfiguracionRestaurante.create({
      nombreRestaurante,
      adminId,
      cantidadMesas,
      menuUrl: menuUrl || null,
      scrapingCompletado: false,
      configuracionInicialCompletada: false
    }, { transaction });

    // Crear proveedor "Propio" si no existe
    const proveedorPropio = await Proveedor.findOne({
      where: { esPropio: true }
    });

    if (!proveedorPropio) {
      await Proveedor.create({
        nombre: 'Propio',
        esPropio: true,
        contacto: 'Productos elaborados en el establecimiento'
      }, { transaction });
    }

    await transaction.commit();

    res.status(201).json({
      success: true,
      message: 'Configuración inicial creada exitosamente',
      data: config,
      siguientesPasos: {
        paso1: menuUrl ? 'Realizar scraping del menú' : 'Crear productos manualmente',
        paso2: 'Crear mesas del restaurante',
        paso3: 'Asignar proveedores y costos a productos',
        paso4: 'Crear usuarios de atención y cocina'
      }
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error en createConfiguracion:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear configuración',
      error: error.message
    });
  }
};

// Actualizar configuración
const updateConfiguracion = async (req, res) => {
  try {
    const { nombreRestaurante, cantidadMesas, menuUrl, scrapingCompletado } = req.body;

    const config = await ConfiguracionRestaurante.findOne();

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'No existe configuración del restaurante'
      });
    }

    await config.update({
      nombreRestaurante: nombreRestaurante || config.nombreRestaurante,
      cantidadMesas: cantidadMesas || config.cantidadMesas,
      menuUrl: menuUrl !== undefined ? menuUrl : config.menuUrl,
      scrapingCompletado: scrapingCompletado !== undefined ? scrapingCompletado : config.scrapingCompletado
    });

    res.json({
      success: true,
      message: 'Configuración actualizada exitosamente',
      data: config
    });
  } catch (error) {
    console.error('Error en updateConfiguracion:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar configuración',
      error: error.message
    });
  }
};

// Marcar scraping como completado
const marcarScrapingCompletado = async (req, res) => {
  try {
    const config = await ConfiguracionRestaurante.findOne();

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'No existe configuración del restaurante'
      });
    }

    await config.update({ scrapingCompletado: true });

    res.json({
      success: true,
      message: 'Scraping marcado como completado',
      siguientePaso: 'Asignar proveedores y costos a los productos importados'
    });
  } catch (error) {
    console.error('Error en marcarScrapingCompletado:', error);
    res.status(500).json({
      success: false,
      message: 'Error al marcar scraping como completado',
      error: error.message
    });
  }
};

// Finalizar configuración inicial
const finalizarConfiguracion = async (req, res) => {
  try {
    const config = await ConfiguracionRestaurante.findOne();

    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'No existe configuración del restaurante'
      });
    }

    // Verificar que se cumplan los requisitos
    const mesasCreadas = await Mesa.count();
    if (mesasCreadas < config.cantidadMesas) {
      return res.status(400).json({
        success: false,
        message: `Debes crear las ${config.cantidadMesas} mesas antes de finalizar`,
        mesasCreadas,
        mesasFaltantes: config.cantidadMesas - mesasCreadas
      });
    }

    const { Producto } = require('../models');
    const productosTotal = await Producto.count();
    if (productosTotal === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debes tener al menos un producto antes de finalizar'
      });
    }

    const productosConProveedor = await Producto.count({
      where: { proveedorId: { [require('sequelize').Op.ne]: null } }
    });
    if (productosConProveedor < productosTotal) {
      return res.status(400).json({
        success: false,
        message: 'Todos los productos deben tener un proveedor asignado',
        productosSinProveedor: productosTotal - productosConProveedor
      });
    }

    // Verificar usuarios de atención y cocina
    const usuariosAtencion = await Usuario.count({ where: { tipo: 'atencion', activo: true } });
    const usuariosCocina = await Usuario.count({ where: { tipo: 'cocina', activo: true } });

    if (usuariosAtencion === 0 || usuariosCocina === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debes crear al menos un usuario de atención y uno de cocina',
        usuariosAtencion,
        usuariosCocina
      });
    }

    await config.update({ configuracionInicialCompletada: true });

    res.json({
      success: true,
      message: '¡Configuración inicial completada! El restaurante está listo para operar',
      data: {
        restaurante: config.nombreRestaurante,
        mesas: mesasCreadas,
        productos: productosTotal,
        usuariosAtencion,
        usuariosCocina
      }
    });
  } catch (error) {
    console.error('Error en finalizarConfiguracion:', error);
    res.status(500).json({
      success: false,
      message: 'Error al finalizar configuración',
      error: error.message
    });
  }
};

// Verificar estado de configuración
const verificarEstadoConfiguracion = async (req, res) => {
  try {
    const config = await ConfiguracionRestaurante.findOne();

    if (!config) {
      return res.json({
        success: true,
        configurado: false,
        mensaje: 'El restaurante no ha sido configurado aún'
      });
    }

    const mesasCreadas = await Mesa.count();
    const { Producto } = require('../models');
    const productosTotal = await Producto.count();
    const productosConProveedor = await Producto.count({
      where: { proveedorId: { [require('sequelize').Op.ne]: null } }
    });
    const usuariosAtencion = await Usuario.count({ where: { tipo: 'atencion', activo: true } });
    const usuariosCocina = await Usuario.count({ where: { tipo: 'cocina', activo: true } });

    const checklist = {
      configuracionCreada: true,
      mesasCompletas: mesasCreadas >= config.cantidadMesas,
      tieneProductos: productosTotal > 0,
      productosConProveedor: productosConProveedor === productosTotal,
      tieneUsuarioAtencion: usuariosAtencion > 0,
      tieneUsuarioCocina: usuariosCocina > 0,
      configuracionFinalizada: config.configuracionInicialCompletada
    };

    const completado = Object.values(checklist).every(v => v === true);

    res.json({
      success: true,
      configurado: completado,
      checklist,
      progreso: {
        mesas: `${mesasCreadas}/${config.cantidadMesas}`,
        productos: `${productosConProveedor}/${productosTotal} con proveedor`,
        usuarios: `${usuariosAtencion} atención, ${usuariosCocina} cocina`
      }
    });
  } catch (error) {
    console.error('Error en verificarEstadoConfiguracion:', error);
    res.status(500).json({
      success: false,
      message: 'Error al verificar estado',
      error: error.message
    });
  }
};

// Función auxiliar para calcular progreso
const calcularProgreso = (config, mesasCreadas, productosConProveedor) => {
  let progreso = 0;
  const pasos = 4; // Total de pasos principales

  // Paso 1: Configuración creada (25%)
  progreso += 25;

  // Paso 2: Mesas creadas (25%)
  if (mesasCreadas >= config.cantidadMesas) {
    progreso += 25;
  } else {
    progreso += Math.floor((mesasCreadas / config.cantidadMesas) * 25);
  }

  // Paso 3: Productos con proveedor (25%)
  if (productosConProveedor > 0) {
    progreso += 25;
  }

  // Paso 4: Configuración finalizada (25%)
  if (config.configuracionInicialCompletada) {
    progreso += 25;
  }

  return Math.min(progreso, 100);
};

module.exports = {
  getConfiguracion,
  createConfiguracion,
  updateConfiguracion,
  marcarScrapingCompletado,
  finalizarConfiguracion,
  verificarEstadoConfiguracion
};
