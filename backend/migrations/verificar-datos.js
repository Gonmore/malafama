// Verificar estado de datos de producción
require('dotenv').config();
const { sequelize } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function verificarDatos() {
  console.log('\n========================================');
  console.log('  VERIFICAR DATOS DE PRODUCCIÓN');
  console.log('========================================\n');

  try {
    const sqlFile = path.join(__dirname, 'verificar-datos-produccion.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    await sequelize.query(sql);

    console.log('\n📊 Verificación completada\n');
    console.log('Revisa la salida anterior para ver el estado.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

verificarDatos();
