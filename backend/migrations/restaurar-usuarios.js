require('dotenv').config();
const { sequelize } = require('../src/config/database');
const bcrypt = require('bcryptjs');

async function restaurarUsuarios() {
  console.log('\n========================================');
  console.log('  RESTAURAR USUARIOS DEL LOCAL');
  console.log('========================================\n');

  try {
    // Buscar el local "Mala Fama Teatro"
    const [locales] = await sequelize.query(
      "SELECT id, nombre, usuario_propietario_id FROM locales WHERE nombre = 'Mala Fama Teatro'"
    );

    if (locales.length === 0) {
      console.error('❌ No se encontró el local "Mala Fama Teatro"');
      process.exit(1);
    }

    const local = locales[0];
    console.log(`✅ Local encontrado: ${local.nombre}`);
    console.log(`   ID: ${local.id}\n`);

    // Contraseña por defecto para los usuarios
    const passwordHash = await bcrypt.hash('malafama2024', 10);

    // Crear usuarios
    const usuarios = [
      {
        email: 'mesero@malafamateatro.local',
        nombre: 'Mesero - Mala Fama Teatro',
        password: passwordHash,
        localId: local.id,
        tipo: 'atencion',
        rolCocina: null
      },
      {
        email: 'cocina@malafamateatro.local',
        nombre: 'Cocina - Mala Fama Teatro',
        password: passwordHash,
        localId: local.id,
        tipo: 'cocina',
        rolCocina: 'cocina'
      },
      {
        email: 'bar@malafamateatro.local',
        nombre: 'Bar - Mala Fama Teatro',
        password: passwordHash,
        localId: local.id,
        tipo: 'bar',
        rolCocina: 'bar'
      }
    ];

    console.log('Creando usuarios...\n');

    for (const user of usuarios) {
      const [result] = await sequelize.query(
        `INSERT INTO usuarios (id, nombre, email, password, local_id, tipo, rol_cocina, activo, created_at, updated_at)
         VALUES (gen_random_uuid(), :nombre, :email, :password, :localId, :tipo, :rolCocina, true, NOW(), NOW())
         RETURNING id, nombre, email`,
        {
          replacements: {
            nombre: user.nombre,
            email: user.email,
            password: user.password,
            localId: user.localId,
            tipo: user.tipo,
            rolCocina: user.rolCocina
          }
        }
      );

      console.log(`✅ ${user.nombre}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Password: malafama2024`);
      console.log(`   ID: ${result[0].id}\n`);
    }

    console.log('========================================');
    console.log('  USUARIOS RESTAURADOS EXITOSAMENTE');
    console.log('========================================\n');
    console.log('⚠️  IMPORTANTE: Cambia las contraseñas desde la app\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  }
}

restaurarUsuarios();
