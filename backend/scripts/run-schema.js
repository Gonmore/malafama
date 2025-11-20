require('dotenv').config();
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function runSchema() {
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

    // Leer schema.sql
    const schemaPath = path.join(__dirname, '..', '..', 'database', 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('⚙ Ejecutando schema.sql...');
    await client.query(schema);
    console.log('✓ Schema ejecutado exitosamente');

    // Leer views.sql
    const viewsPath = path.join(__dirname, '..', '..', 'database', 'views.sql');
    if (fs.existsSync(viewsPath)) {
      const views = fs.readFileSync(viewsPath, 'utf8');
      console.log('⚙ Ejecutando views.sql...');
      await client.query(views);
      console.log('✓ Views creadas exitosamente');
    }

    // Ejecutar migración de onboarding
    const migrationPath = path.join(__dirname, '..', '..', 'database', 'migrations', '002_add_onboarding_field.sql');
    if (fs.existsSync(migrationPath)) {
      const migration = fs.readFileSync(migrationPath, 'utf8');
      console.log('⚙ Ejecutando migración de onboarding...');
      await client.query(migration);
      console.log('✓ Migración ejecutada exitosamente');
    }

    await client.end();
    console.log('\n✅ Base de datos completamente configurada!');
    console.log('👉 Ahora puedes iniciar el backend con: npm run dev');
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    if (error.message.includes('ya existe')) {
      console.log('⚠ Las tablas ya existen. Si necesitas recrearlas, elimina la base de datos primero.');
    }
    process.exit(1);
  }
}

runSchema();
