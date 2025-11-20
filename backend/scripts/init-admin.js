require('dotenv').config();
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

async function initializeData() {
  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || 'postgres',
    password: String(process.env.DB_PASSWORD),
    database: process.env.DB_NAME || 'malafama'
  });

  try {
    await client.connect();
    console.log('✓ Conectado a base de datos');

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // 1. Crear usuario admin si no existe
    const checkAdmin = await client.query(
      "SELECT id FROM usuarios WHERE email = 'admin@malafama.com'"
    );

    let adminId;
    if (checkAdmin.rows.length === 0) {
      const adminResult = await client.query(
        `INSERT INTO usuarios (id, nombre, email, password, tipo, activo, onboarding_completado, created_at, updated_at) 
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW(), NOW()) 
         RETURNING id`,
        ['Admin Principal', 'admin@malafama.com', hashedPassword, 'admin', true, false]
      );
      adminId = adminResult.rows[0].id;
      console.log('✓ Usuario admin creado: admin@malafama.com / admin123');
    } else {
      adminId = checkAdmin.rows[0].id;
      console.log('✓ Usuario admin ya existe');
    }

    // 2. Crear proveedores si no existen
    const checkProveedores = await client.query("SELECT COUNT(*) FROM proveedores");
    
    if (checkProveedores.rows[0].count === '0') {
      await client.query(`
        INSERT INTO proveedores (id, nombre, contacto, email, telefono, es_propio, created_at, updated_at)
        VALUES 
        (gen_random_uuid(), 'Distribuidora Central', 'Juan Pérez', 'contacto@distribuidora.com', '+1234567890', false, NOW(), NOW()),
        (gen_random_uuid(), 'Carnes Premium', 'María García', 'ventas@carnespremium.com', '+1234567891', false, NOW(), NOW()),
        (gen_random_uuid(), 'Verduras Frescas', 'Carlos López', 'info@verdurasfrescas.com', '+1234567892', false, NOW(), NOW())
      `);
      console.log('✓ 3 proveedores creados');
    } else {
      console.log('✓ Proveedores ya existen');
    }

    await client.end();
    console.log('\n✅ Datos iniciales creados!');
    console.log('\n🔑 Credenciales de acceso:');
    console.log('   Email: admin@malafama.com');
    console.log('   Password: admin123');
    console.log('\n👉 Ahora puedes hacer login en http://localhost:3000');
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  }
}

initializeData();
