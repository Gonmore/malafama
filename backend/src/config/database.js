const { Sequelize } = require('sequelize');

// Configuración de la conexión a PostgreSQL
const sequelize = new Sequelize(
  process.env.DB_NAME || 'malafama',
  process.env.DB_USER || 'postgres',
  String(process.env.DB_PASSWORD || ''),
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    dialect: 'postgres',
    // Reduce noise: only log SQL when LOG_SQL=true; otherwise silence even in development
    logging: process.env.LOG_SQL === 'true' ? console.log : false,
    pool: {
      max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
      min: parseInt(process.env.DB_POOL_MIN, 10) || 2,
      acquire: parseInt(process.env.DB_POOL_ACQUIRE, 10) || 30000,
      idle: parseInt(process.env.DB_POOL_IDLE, 10) || 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  }
);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Función para probar la conexión
const testConnection = async () => {
  const retries = parseInt(process.env.DB_WAIT_RETRIES, 10) || 1;
  const delaySeconds = parseInt(process.env.DB_WAIT_SECONDS, 10) || 2;
  let lastError = null;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await sequelize.authenticate();
      console.log('✓ Conexión a PostgreSQL establecida correctamente');
      return true;
    } catch (error) {
      lastError = error;
      console.error(`✗ Error al conectar con PostgreSQL (intento ${attempt}/${retries}):`, error.message);

      if (attempt < retries) {
        await wait(delaySeconds * 1000);
      }
    }
  }

  throw lastError;
};

module.exports = {
  sequelize,
  testConnection
};
