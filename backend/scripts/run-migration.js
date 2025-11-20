require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: String(process.env.DB_PASSWORD),
    database: process.env.DB_NAME || 'malafama'
  });

  try {
    await client.connect();
    console.log(`✓ Conectado a base de datos '${process.env.DB_NAME}'`);

    // Si se pasa argumento, ejecutar esa migración específica
    const migrationName = process.argv[2] || '002_add_onboarding_field.sql';
    
    const migrationPath = path.join(__dirname, '..', '..', 'database', 'migrations', migrationName);
    
    if (fs.existsSync(migrationPath)) {
      const migration = fs.readFileSync(migrationPath, 'utf8');
      console.log(`⚙ Ejecutando migración: ${migrationName}...`);
      await client.query(migration);
      console.log(`✓ Migración ${migrationName} completada exitosamente`);
    } else {
      console.log(`⚠ Archivo de migración no encontrado: ${migrationName}`);
    }

    await client.end();
    console.log('\n✅ Proceso de migración completado!');
    
  } catch (error) {
    if (error.message.includes('ya existe')) {
      console.log('✓ Los cambios ya existen. Todo listo!');
    } else {
      console.error('✗ Error:', error.message);
    }
    process.exit(0);
  }
}

runMigration();
