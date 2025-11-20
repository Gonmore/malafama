const scrapingService = require('../services/scraping.service');
const { Producto } = require('../models');

// Scraping de menú desde URL
const scrapearMenu = async (req, res) => {
  try {
    const { url, metodo } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'URL es requerida'
      });
    }

    // Validar URL
    if (!scrapingService.validateUrl(url)) {
      return res.status(400).json({
        success: false,
        message: 'URL inválida'
      });
    }

    // Seleccionar método de scraping
    let resultado;
    if (metodo === 'simple') {
      resultado = await scrapingService.scrapeMenuSimple(url);
    } else {
      resultado = await scrapingService.scrapeMenu(url);
    }

    if (!resultado.success || resultado.productos.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No se pudieron extraer productos del menú. Intenta con el método alternativo o crea los productos manualmente.',
        data: { productosEncontrados: 0 }
      });
    }

    res.json({
      success: true,
      message: `${resultado.productos.length} productos extraídos exitosamente`,
      data: {
        url: resultado.url,
        productos: resultado.productos,
        total: resultado.productos.length
      }
    });
  } catch (error) {
    console.error('Error en scrapearMenu:', error);
    res.status(500).json({
      success: false,
      message: 'Error al realizar scraping del menú',
      error: error.message,
      hint: 'Considera crear los productos manualmente'
    });
  }
};

// Previsualizar scraping sin guardar (para onboarding)
const previsualizarScrapingUrl = async (req, res) => {
  try {
    const { url } = req.query;

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

    // Intentar scraping simple primero (más rápido)
    let resultado;
    try {
      resultado = await scrapingService.scrapeMenuSimple(url);
    } catch (error) {
      // Si falla, intentar con Puppeteer
      resultado = await scrapingService.scrapeMenu(url);
    }

    res.json({
      success: true,
      message: 'Preview del scraping',
      data: {
        url,
        muestra: resultado.productos.slice(0, 5), // Solo primeros 5
        total: resultado.productos.length
      }
    });
  } catch (error) {
    console.error('Error en previsualizarScrapingUrl:', error);
    res.status(500).json({
      success: false,
      message: 'Error al previsualizar scraping',
      error: error.message
    });
  }
};

// Previsualizar scraping (POST con URL en body)
const previsualizarScraping = async (req, res) => {
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

    // Intentar scraping simple primero (más rápido)
    let resultado;
    try {
      resultado = await scrapingService.scrapeMenuSimple(url);
    } catch (error) {
      // Si falla, intentar con Puppeteer
      resultado = await scrapingService.scrapeMenu(url);
    }

    res.json({
      success: true,
      message: 'Preview del scraping',
      data: {
        url,
        productos: resultado.productos, // Todos los productos para el wizard
        total: resultado.productos.length
      }
    });
  } catch (error) {
    console.error('Error en previsualizarScraping:', error);
    res.status(500).json({
      success: false,
      message: 'Error al previsualizar scraping',
      error: error.message
    });
  }
};

// Importar productos scrapeados con costo y proveedor
const importarProductosScrapeados = async (req, res) => {
  try {
    const { productos } = req.body;

    if (!Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de productos'
      });
    }

    // Validar que tengan costo y proveedor
    const productosValidos = productos.every(p => 
      p.nombre && p.precio && p.costo !== undefined && p.proveedor_id
    );

    if (!productosValidos) {
      return res.status(400).json({
        success: false,
        message: 'Cada producto debe tener: nombre, precio, costo y proveedor_id'
      });
    }

    const productosGuardados = await Producto.bulkCreate(productos, {
      validate: true
    });

    res.status(201).json({
      success: true,
      message: `${productosGuardados.length} productos importados exitosamente`,
      data: {
        productos: productosGuardados,
        total: productosGuardados.length
      }
    });
  } catch (error) {
    console.error('Error en importarProductosScrapeados:', error);
    res.status(500).json({
      success: false,
      message: 'Error al importar productos',
      error: error.message
    });
  }
};

// Confirmar y guardar productos scrapeados (legacy - mantener compatibilidad)
const confirmarProductosScrapeados = async (req, res) => {
  try {
    const { productos } = req.body;

    if (!Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de productos'
      });
    }

    // Los productos scrapeados no tienen costo ni proveedor aún
    // El admin los asignará después
    const productosGuardados = await Producto.bulkCreate(productos, {
      validate: true
    });

    res.status(201).json({
      success: true,
      message: `${productosGuardados.length} productos importados exitosamente`,
      data: {
        productos: productosGuardados,
        total: productosGuardados.length,
        siguientePaso: 'Asignar proveedores y costos a cada producto'
      }
    });
  } catch (error) {
    console.error('Error en confirmarProductosScrapeados:', error);
    res.status(500).json({
      success: false,
      message: 'Error al guardar productos',
      error: error.message
    });
  }
};

// Test de scraping (desarrollo)
const testScraping = async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.json({
        success: true,
        message: 'Servicio de scraping funcionando',
        ejemplo: 'GET /api/v1/scraping/test?url=https://ejemplo.com/menu'
      });
    }

    const resultado = await scrapingService.scrapeMenu(url);

    res.json({
      success: true,
      data: {
        url,
        productosEncontrados: resultado.productos.length,
        muestra: resultado.productos.slice(0, 3)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error en test de scraping',
      error: error.message
    });
  }
};

module.exports = {
  scrapearMenu,
  previsualizarScraping,
  previsualizarScrapingUrl,
  importarProductosScrapeados,
  confirmarProductosScrapeados,
  testScraping
};
