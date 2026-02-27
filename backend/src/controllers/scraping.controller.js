const scrapingService = require('../services/scraping.service');
const { Producto } = require('../models');

const { randomUUID } = require('crypto');

// In-memory jobs store (sufficient for single-instance deploy)
const PREVIEW_JOBS = new Map();
const PREVIEW_JOB_TTL_MS = 15 * 60 * 1000;

const pruneJobs = () => {
  const now = Date.now();
  for (const [id, job] of PREVIEW_JOBS.entries()) {
    if (!job?.updatedAt || now - job.updatedAt > PREVIEW_JOB_TTL_MS) {
      PREVIEW_JOBS.delete(id);
    }
  }
};

const sanitizeProgress = (job) => {
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    phase: job.phase,
    progress: job.progress,
    productsFound: job.productsFound,
    tabs: job.tabs,
    url: job.url,
    message: job.message,
    error: job.error ? String(job.error) : null,
    total: job.total,
    updatedAt: job.updatedAt,
    done: job.status === 'done'
  };
};

// Start a scraping preview job that can be polled for progress
const iniciarPreviewJob = async (req, res) => {
  try {
    pruneJobs();

    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL es requerida' });
    }
    if (!scrapingService.validateUrl(url)) {
      return res.status(400).json({ success: false, message: 'URL inválida' });
    }

    const id = randomUUID();
    const job = {
      id,
      url,
      status: 'running',
      phase: 'starting',
      progress: 0,
      productsFound: 0,
      total: null,
      tabs: { total: null, current: 0 },
      message: 'Iniciando scraping...',
      error: null,
      result: null,
      updatedAt: Date.now()
    };

    PREVIEW_JOBS.set(id, job);

    // Run async (fire-and-forget)
    (async () => {
      try {
        job.phase = 'simple';
        job.message = 'Intentando scraping simple...';
        job.progress = 10;
        job.updatedAt = Date.now();

        let resultado = null;
        try {
          resultado = await scrapingService.scrapeMenuSimple(url);
        } catch (e) {
          resultado = null;
        }

        if (resultado?.success && Array.isArray(resultado.productos) && resultado.productos.length > 0) {
          job.status = 'done';
          job.phase = 'done';
          job.progress = 100;
          job.productsFound = resultado.productos.length;
          job.total = resultado.productos.length;
          job.message = 'Scraping completado (simple)';
          job.result = resultado.productos;
          job.updatedAt = Date.now();
          return;
        }

        job.phase = 'puppeteer';
        job.message = 'Scraping con navegador (Puppeteer)...';
        job.progress = 20;
        job.updatedAt = Date.now();

        const resP = await scrapingService.scrapeMenu(url, {
          onProgress: (p) => {
            if (typeof p?.totalTabs === 'number') job.tabs.total = p.totalTabs;
            if (typeof p?.currentTab === 'number') job.tabs.current = p.currentTab;
            if (typeof p?.productsFound === 'number') job.productsFound = p.productsFound;

            // Progress: 20% base + 80% based on tabs (if known)
            if (job.tabs.total && job.tabs.total > 0) {
              const ratio = Math.min(1, Math.max(0, job.tabs.current / job.tabs.total));
              job.progress = Math.round(20 + ratio * 80);
            }
            job.message = p?.message || job.message;
            job.updatedAt = Date.now();
          }
        });

        if (!resP?.success || !Array.isArray(resP.productos) || resP.productos.length === 0) {
          job.status = 'error';
          job.phase = 'error';
          job.progress = 100;
          job.error = 'No se pudieron extraer productos.';
          job.message = 'No se pudieron extraer productos.';
          job.updatedAt = Date.now();
          return;
        }

        job.status = 'done';
        job.phase = 'done';
        job.progress = 100;
        job.productsFound = resP.productos.length;
        job.total = resP.productos.length;
        job.message = 'Scraping completado';
        job.result = resP.productos;
        job.updatedAt = Date.now();
      } catch (err) {
        job.status = 'error';
        job.phase = 'error';
        job.progress = 100;
        job.error = err?.message || String(err);
        job.message = 'Error en scraping';
        job.updatedAt = Date.now();
      }
    })();

    return res.status(202).json({
      success: true,
      message: 'Scraping iniciado',
      data: sanitizeProgress(job)
    });
  } catch (error) {
    console.error('Error en iniciarPreviewJob:', error);
    return res.status(500).json({ success: false, message: 'Error al iniciar scraping', error: error.message });
  }
};

// Get preview job progress or final result
const getPreviewJob = async (req, res) => {
  try {
    pruneJobs();
    const { jobId } = req.params;
    const job = PREVIEW_JOBS.get(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: 'Job no encontrado o expirado' });
    }

    const payload = sanitizeProgress(job);
    if (job.status === 'done') {
      payload.productos = job.result || [];
      payload.total = payload.productos.length;
    }

    return res.json({ success: true, data: payload });
  } catch (error) {
    console.error('Error en getPreviewJob:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener job', error: error.message });
  }
};

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
  iniciarPreviewJob,
  getPreviewJob,
  scrapearMenu,
  previsualizarScraping,
  previsualizarScrapingUrl,
  importarProductosScrapeados,
  confirmarProductosScrapeados,
  testScraping
};
