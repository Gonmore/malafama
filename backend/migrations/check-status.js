require('dotenv').config();
const { sequelize } = require('../src/config/database');

async function verificar() {
  try {
    // Verificar locales
    const [locales] = await sequelize.query(
      "SELECT id, nombre, created_at FROM locales WHERE nombre NOT LIKE '%Test%'"
    );
    
    console.log('\n📍 LOCALES DE PRODUCCIÓN:');
    console.log('─'.repeat(80));
    locales.forEach(l => {
      console.log(`ID: ${l.id}`);
      console.log(`Nombre: ${l.nombre}`);
      console.log(`Creado: ${l.created_at}`);
      console.log('─'.repeat(80));
    });

    // Verificar usuarios
    const [usuarios] = await sequelize.query(
      "SELECT id, nombre, email, local_id FROM usuarios WHERE email LIKE '%malafamateatro.local%'"
    );
    
    console.log('\n👥 USUARIOS DEL LOCAL DE PRODUCCIÓN:');
    console.log('─'.repeat(80));
    if (usuarios.length === 0) {
      console.log('❌ NO SE ENCONTRARON USUARIOS - FUERON ELIMINADOS');
    } else {
      usuarios.forEach(u => {
        console.log(`Nombre: ${u.nombre}`);
        console.log(`Email: ${u.email}`);
        console.log('─'.repeat(40));
      });
    }

    // Verificar comandas del local
    if (locales.length > 0) {
      const localId = locales[0].id;
      const [comandas] = await sequelize.query(
        `SELECT COUNT(*) as total FROM comandas WHERE local_id = '${localId}'`
      );
      console.log(`\n📋 COMANDAS DEL LOCAL: ${comandas[0].total}`);
      
      const [mesas] = await sequelize.query(
        `SELECT COUNT(*) as total FROM mesas WHERE local_id = '${localId}'`
      );
      console.log(`🪑 MESAS DEL LOCAL: ${mesas[0].total}\n`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

verificar();
