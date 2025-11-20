const { Mesa, Producto, Usuario, Proveedor, Local } = require('../models');
const scrapingService = require('../services/scraping.service');

/**
 * Obtener estado del onboarding del usuario
 */
const getEstadoOnboarding = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.user.id);

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Verificar qué pasos están completados
    const localesCount = await Local.count({ 
      where: { usuarioPropietarioId: req.user.id } 
    });
    
    const mesasCount = await Mesa.count();
    const productosCount = await Producto.count();

    const estado = {
      onboarding_completado: usuario.onboarding_completado,
      pasos: {
        local: localesCount > 0,
        mesas: mesasCount > 0,
        productos: productosCount > 0
      },
      totales: {
        locales: localesCount,
        mesas: mesasCount,
        productos: productosCount
      }
    };

    res.json({
      success: true,
      data: estado
    });
  } catch (error) {
    console.error('Error en getEstadoOnboarding:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estado del onboarding',
      error: error.message
    });
  }
};

/**
 * Completar paso 1: Crear mesas con local_id
 */
const completarPasoMesas = async (req, res) => {
  try {
    const { cantidad, ubicacion, capacidad, localId } = req.body;

    if (!cantidad || cantidad < 1) {
      return res.status(400).json({
        success: false,
        message: 'Cantidad de mesas inválida'
      });
    }

    if (!localId) {
      return res.status(400).json({
        success: false,
        message: 'localId es requerido. Debes crear un local primero.'
      });
    }

    // Verificar que el local existe y pertenece al usuario
    const local = await Local.findOne({
      where: {
        id: localId,
        usuarioPropietarioId: req.user.id
      }
    });

    if (!local) {
      return res.status(404).json({
        success: false,
        message: 'Local no encontrado o no pertenece al usuario'
      });
    }

    // Crear mesas en bulk
    const mesasCreadas = await Mesa.bulkCreate(
      Array.from({ length: cantidad }, (_, i) => ({
        nombre: `Mesa ${i + 1}`,
        numero: i + 1,
        ubicacion: ubicacion || 'General',
        capacidad: capacidad || 4,
        estado: 'disponible',
        localId: localId
      }))
    );

    res.status(201).json({
      success: true,
      message: `${mesasCreadas.length} mesas creadas exitosamente`,
      data: {
        mesas: mesasCreadas,
        total: mesasCreadas.length
      }
    });
  } catch (error) {
    console.error('Error en completarPasoMesas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear mesas',
      error: error.message
    });
  }
};

const previewScraping = async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL es requerida'
      });
    }

    if (!scrapingService.validateUrl(url)) {
      return res.status(400).json({
        success: false,
        message: 'URL inválida'
      });
    }

    // Intentar scraping
    let resultado;
    try {
      console.log('Intentando scraping simple de:', url);
      resultado = await scrapingService.scrapeMenuSimple(url);
      console.log('Resultado scraping:', resultado.productos.length, 'productos');
    } catch (error) {
      console.log('Scraping simple falló, intentando con Puppeteer:', error.message);
      try {
        resultado = await scrapingService.scrapeMenu(url);
      } catch (error2) {
        console.error('Ambos métodos de scraping fallaron:', error2.message);
        return res.status(500).json({
          success: false,
          message: 'No se pudieron extraer productos. Intenta crear los productos manualmente.',
          data: { productosEncontrados: 0 },
          error: error2.message
        });
      }
    }

    if (!resultado.success || resultado.productos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se pudieron extraer productos. Intenta crear los productos manualmente.',
        data: { productosEncontrados: 0 }
      });
    }

    res.json({
      success: true,
      message: `${resultado.productos.length} productos encontrados`,
      data: {
        url,
        productos: resultado.productos,
        total: resultado.productos.length
      }
    });
  } catch (error) {
    console.error('Error en previewScraping:', error);
    res.status(500).json({
      success: false,
      message: 'Error al realizar scraping',
      error: error.message
    });
  }
};

/**
 * Completar paso 3: Importar productos con costo, proveedor y localId
 */
const importarProductos = async (req, res) => {
  try {
    const { productos, localId } = req.body;

    if (!Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de productos'
      });
    }

    if (!localId) {
      return res.status(400).json({
        success: false,
        message: 'localId es requerido'
      });
    }

    // Validar que cada producto tenga los campos requeridos
    const productosValidos = productos.every(p => 
      p.nombre && p.precio && p.costo !== undefined && p.proveedorId
    );

    if (!productosValidos) {
      return res.status(400).json({
        success: false,
        message: 'Cada producto debe tener: nombre, precio, costo y proveedorId'
      });
    }

    // Agregar localId a todos los productos
    const productosConLocal = productos.map(p => ({
      ...p,
      localId
    }));

    // Crear productos
    const productosCreados = await Producto.bulkCreate(productosConLocal, {
      validate: true
    });

    res.status(201).json({
      success: true,
      message: `${productosCreados.length} productos importados exitosamente`,
      data: {
        productos: productosCreados,
        total: productosCreados.length
      }
    });
  } catch (error) {
    console.error('Error en importarProductos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al importar productos',
      error: error.message
    });
  }
};

/**
 * Crear productos manualmente (bulk) con localId
 */
const crearProductosBulk = async (req, res) => {
  try {
    const { productos, localId } = req.body;

    if (!Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de productos'
      });
    }

    if (!localId) {
      return res.status(400).json({
        success: false,
        message: 'localId es requerido'
      });
    }

    // Validar campos requeridos
    for (const producto of productos) {
      if (!producto.nombre || !producto.precio || producto.costo === undefined || !producto.proveedorId) {
        return res.status(400).json({
          success: false,
          message: `Producto "${producto.nombre || 'sin nombre'}" falta campos: nombre, precio, costo y proveedorId son requeridos`
        });
      }
    }

    // Agregar localId a todos los productos
    const productosConLocal = productos.map(p => ({
      ...p,
      localId
    }));

    const productosCreados = await Producto.bulkCreate(productosConLocal, {
      validate: true
    });

    res.status(201).json({
      success: true,
      message: `${productosCreados.length} productos creados exitosamente`,
      data: {
        productos: productosCreados,
        total: productosCreados.length
      }
    });
  } catch (error) {
    console.error('Error en crearProductosBulk:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear productos',
      error: error.message
    });
  }
};

/**
 * Marcar onboarding como completado
 */
const completarOnboarding = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.user.id);

    if (!usuario) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    // Verificar que se completaron los pasos mínimos
    const localesCount = await Local.count({
      where: { usuarioPropietarioId: req.user.id }
    });
    const mesasCount = await Mesa.count();
    const productosCount = await Producto.count();

    if (localesCount === 0 || mesasCount === 0 || productosCount === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debes completar todos los pasos del onboarding (crear local, mesas y productos)',
        data: {
          localesCreados: localesCount,
          mesasCreadas: mesasCount,
          productosCreados: productosCount
        }
      });
    }

    // Marcar onboarding como completado
    usuario.onboarding_completado = true;
    await usuario.save();

    res.json({
      success: true,
      message: '¡Configuración inicial completada! Ya puedes comenzar a usar el sistema.',
      data: {
        onboarding_completado: true,
        resumen: {
          locales: localesCount,
          mesas: mesasCount,
          productos: productosCount
        }
      }
    });
  } catch (error) {
    console.error('Error en completarOnboarding:', error);
    res.status(500).json({
      success: false,
      message: 'Error al completar onboarding',
      error: error.message
    });
  }
};

module.exports = {
  getEstadoOnboarding,
  completarPasoMesas,
  previewScraping,
  importarProductos,
  crearProductosBulk,
  completarOnboarding
};
