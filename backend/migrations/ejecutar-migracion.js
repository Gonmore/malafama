// Script para ejecutar migraciones SQL desde Node.js
require('dotenv').config();
const { sequelize } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function ejecutarMigracion() {
  console.log('\n========================================');
  console.log('  EJECUTAR MIGRACIÓN - MalaFama');
  console.log('========================================\n');

  try {
    // Leer archivo SQL
    const migrationFile = path.join(__dirname, '20251121_add_payment_fields_to_comandas.sql');
    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log('📄 Archivo de migración cargado');
    console.log('🔗 Conectando a la base de datos...\n');

    // Ejecutar SQL
    await sequelize.query(sql);

    console.log('✅ Migración ejecutada exitosamente\n');
    console.log('Campos agregados a la tabla "comandas":');
    console.log('  ✓ forma_pago (efectivo, qr, mixto)');
    console.log('  ✓ cantidad_efectivo');
    console.log('  ✓ cantidad_qr');
    console.log('  ✓ comprobante\n');

    console.log('========================================');
    console.log('  MIGRACIÓN COMPLETADA');
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al ejecutar migración:', error.message);
    console.error('\nDetalles:', error);
    process.exit(1);
  }
}

ejecutarMigracion();
