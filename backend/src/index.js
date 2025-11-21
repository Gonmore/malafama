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

// Inicializar Express
const app = express();
const server = http.createServer(app);

// Inicializar Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
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
comandaController.setSocketIO(io);
pedidoController.setSocketIO(io);

// Middlewares de seguridad
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting - configuración ajustada para uso en restaurante
// Permite ~500 requests por minuto (suficiente para múltiples dispositivos con polling)
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 1 * 60 * 1000, // 1 minuto
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500, // 500 requests por minuto
  message: 'Demasiadas peticiones desde esta IP, por favor intente más tarde.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for Socket.io connections
  skip: (req) => req.path.includes('/socket.io')
});
app.use('/api/', limiter);

// Middlewares generales
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' })); // Aumentar límite para logos en Base64
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos (uploads)
app.use('/uploads', express.static('uploads'));

// Rutas de API
const API_VERSION = process.env.API_VERSION || 'v1';
app.use(`/api/${API_VERSION}/auth`, authRoutes);
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

const startServer = async () => {
  try {
    // Probar conexión a base de datos
    await testConnection();
    
    // Sincronizar modelos (solo en desarrollo)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: false });
      console.log('✓ Modelos sincronizados con la base de datos');
    }
    
    // Iniciar servidor
    server.listen(PORT, () => {
      console.log(`✓ Servidor corriendo en puerto ${PORT}`);
      console.log(`✓ Ambiente: ${process.env.NODE_ENV}`);
      console.log(`✓ API Version: ${API_VERSION}`);
      console.log(`✓ Socket.io inicializado`);
    });
  } catch (error) {
    console.error('✗ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

startServer();

module.exports = { app, server, io };
