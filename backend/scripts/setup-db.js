require('dotenv').config();
const { Client } = require('pg');

async function setupDatabase() {
  // Conectar a postgres para crear la base de datos si no existe
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: String(process.env.DB_PASSWORD),
    database: 'postgres' // Conectar a postgres para poder crear otras bases
  });

  try {
    await client.connect();
    console.log('✓ Conectado a PostgreSQL');

    // Verificar si la base de datos existe
    const result = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [process.env.DB_NAME || 'malafama']
    );

    if (result.rows.length === 0) {
      console.log(`⚠ Base de datos '${process.env.DB_NAME}' no existe. Creándola...`);
      await client.query(`CREATE DATABASE ${process.env.DB_NAME}`);
      console.log(`✓ Base de datos '${process.env.DB_NAME}' creada exitosamente`);
    } else {
      console.log(`✓ Base de datos '${process.env.DB_NAME}' ya existe`);
    }

    await client.end();
    console.log('✓ Setup completado. Ahora ejecuta el schema.sql');
    
  } catch (error) {
    console.error('✗ Error en setup:', error.message);
    process.exit(1);
  }
}

setupDatabase();
