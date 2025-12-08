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
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    define: {
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at'
    }
  }
);

// Función para probar la conexión
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✓ Conexión a PostgreSQL establecida correctamente');
    return true;
  } catch (error) {
    console.error('✗ Error al conectar con PostgreSQL:', error.message);
    throw error;
  }
};

module.exports = {
  sequelize,
  testConnection
};
