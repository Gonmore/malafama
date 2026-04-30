require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');

// Importar configuraciones
const { sequelize, testConnection } = require('./config/database');
const { initializeSocket } = require('./config/socket');

// Importar rutas
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const productRoutes = require('./routes/product.routes');
const mesaRoutes = require('./routes/mesa.routes');
const comandaRoutes = require('./routes/comanda.routes');
const pedidoRoutes = require('./routes/pedido.routes');
const proveedorRoutes = require('./routes/proveedor.routes');
const reporteRoutes = require('./routes/reporte.routes');
const scrapingRoutes = require('./routes/scraping.routes');
const configRoutes = require('./routes/config.routes');
const onboardingRoutes = require('./routes/onboarding.routes');
const localesRoutes = require('./routes/locales.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const platformAdminRoutes = require('./routes/platformAdmin.routes');
const eventoRoutes = require('./routes/evento.routes');
const alertaRoutes = require('./routes/alerta.routes');
const asignacionRoutes = require('./routes/asignacion.routes');

// Inicializar Express
const app = express();
const server = http.createServer(app);
app.set('trust proxy', process.env.TRUST_PROXY || 1);
const isDevelopment = process.env.NODE_ENV === 'development';

// Inicializar Socket.io
const parsedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(s => s.trim());
const io = new Server(server, {
  cors: {
    origin: parsedOrigins.length === 1 ? parsedOrigins[0] : parsedOrigins,
    methods: ['GET', 'POST']
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e6,
  transports: ['websocket', 'polling']
});

// Guardar io en app para acceso global
app.set('io', io);
initializeSocket(io);

// Inicializar Socket.io en los controladores que lo necesitan
const comandaController = require('./controllers/comanda.controller');
const pedidoController = require('./controllers/pedido.controller');
const alertaController = require('./controllers/alerta.controller');
const asignacionController = require('./controllers/asignacion.controller');
comandaController.setSocketIO(io);
pedidoController.setSocketIO(io);
alertaController.setSocketIO(io);
asignacionController.setSocketIO(io);

// Middlewares de seguridad
app.use(helmet());
app.use(cors({
  origin: parsedOrigins.length === 1 ? parsedOrigins[0] : parsedOrigins,
  credentials: true
}));

const logRateLimitHit = (scope) => (req) => {
  console.warn('Rate limit excedido:', {
    scope,
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    forwardedFor: req.headers['x-forwarded-for'],
    userAgent: req.get('user-agent') || 'unknown',
    authHeader: req.headers.authorization ? 'present' : 'missing'
  });
};

const isSocketRequest = (req) => {
  const url = req.originalUrl || req.path || '';
  return url.includes('/socket.io');
};

const isAuthRequest = (req, apiVersion) => {
  const url = req.originalUrl || req.path || '';
  return url.includes(`/api/${apiVersion}/auth`);
};

// Rate limiting general del API. En desarrollo local se desactiva para no romper
// vistas con polling intenso mientras se depura el sistema.
const apiLimiter = isDevelopment
  ? null
  : rateLimit({
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 1 * 60 * 1000,
      max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 30000,
      message: 'Demasiadas peticiones desde esta IP, por favor intente más tarde.',
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => isSocketRequest(req) || isAuthRequest(req, API_VERSION),
      handler: (req, res, _next, options) => {
        logRateLimitHit('api')(req);
        res.status(options.statusCode).json({
          success: false,
          message: options.message
        });
      }
    });

// Rate limiting específico para login: protege credenciales sin bloquear por tráfico funcional del panel.
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS, 10) || (isDevelopment ? 1000 : 100),
  message: 'Demasiados intentos de inicio de sesión. Intente nuevamente en unos minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res, _next, options) => {
    logRateLimitHit('auth')(req);
    res.status(options.statusCode).json({
      success: false,
      message: options.message
    });
  }
});

if (apiLimiter) {
  app.use('/api/', apiLimiter);
}

// Middlewares generales
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' })); // Aumentar límite para logos en Base64
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos (uploads)
app.use('/uploads', express.static('uploads'));

// Rutas de API
const API_VERSION = process.env.API_VERSION || 'v1';
app.use(`/api/${API_VERSION}/auth`, authLimiter, authRoutes);
app.use(`/api/${API_VERSION}/users`, userRoutes);
app.use(`/api/${API_VERSION}/usuarios`, userRoutes); // Alias en español
app.use(`/api/${API_VERSION}/products`, productRoutes);
app.use(`/api/${API_VERSION}/mesas`, mesaRoutes);
app.use(`/api/${API_VERSION}/comandas`, comandaRoutes);
app.use(`/api/${API_VERSION}/pedidos`, pedidoRoutes);
app.use(`/api/${API_VERSION}/proveedores`, proveedorRoutes);
app.use(`/api/${API_VERSION}/reportes`, reporteRoutes);
app.use(`/api/${API_VERSION}/scraping`, scrapingRoutes);
app.use(`/api/${API_VERSION}/config`, configRoutes);
app.use(`/api/${API_VERSION}/onboarding`, onboardingRoutes);
app.use(`/api/${API_VERSION}/locales`, localesRoutes);
app.use(`/api/${API_VERSION}/dashboard`, dashboardRoutes);
app.use(`/api/${API_VERSION}/platform-admin`, platformAdminRoutes);
app.use(`/api/${API_VERSION}/eventos`, eventoRoutes);
app.use(`/api/${API_VERSION}/alertas`, alertaRoutes);
app.use(`/api/${API_VERSION}/asignaciones`, asignacionRoutes);

// Ruta de health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'MalaFama API'
  });
});

// Manejo de rutas no encontradas
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Ruta no encontrada'
  });
});

// Manejador global de errores
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';
  
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 5000;

const startServer = async ({ port, startScheduler } = {}) => {
  try {
    // Probar conexión a base de datos
    await testConnection();
    
    // Sincronizar modelos (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: false });
      console.log('✓ Modelos sincronizados con la base de datos');
    }
    
    const effectivePort = port ?? PORT;
    const forceDisableScheduler = process.env.DISABLE_SCHEDULER === 'true';
    const forceEnableScheduler = process.env.ENABLE_SCHEDULER === 'true';
    const explicitStartScheduler = typeof startScheduler === 'boolean' ? startScheduler : null;
    const defaultSchedulerState = process.env.NODE_ENV === 'production';
    const baseSchedulerState = explicitStartScheduler ?? defaultSchedulerState;
    const shouldStartScheduler = forceDisableScheduler ? false : (forceEnableScheduler || baseSchedulerState);

    // Iniciar servidor
    await new Promise((resolve) => {
      server.listen(effectivePort, () => {
        const actualPort = server.address()?.port;
        console.log(`✓ Servidor corriendo en puerto ${actualPort}`);
        console.log(`✓ Ambiente: ${process.env.NODE_ENV}`);
        console.log(`✓ API Version: ${API_VERSION}`);
        console.log(`✓ Socket.io inicializado`);
        resolve();
      });
    });

    // Start Firebase → PostgreSQL seat sync
    try {
      const { startFirebaseSync } = require('./services/firebaseSync.service');
      startFirebaseSync(io).catch((err) => {
        console.error('[Firebase] Sync startup error:', err.message || err);
      });
    } catch (err) {
      console.warn('[Firebase] Could not load sync service:', err.message || err);
    }

    // Start background scheduler for daily reports (6 AM run)
    if (shouldStartScheduler) {
      try {
        const { scheduleDailyReports } = require('./services/reportes.scheduler');
        scheduleDailyReports();
      } catch (err) {
        console.error('No se pudo iniciar reportes.scheduler:', err.message || err);
      }
    } else if (isDevelopment) {
      console.log('⏸️ Reportes Scheduler deshabilitado en desarrollo');
    }
  } catch (error) {
    console.error('✗ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  startServer();
}

module.exports = { app, server, io, startServer };
