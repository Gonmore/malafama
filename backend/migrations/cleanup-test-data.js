// Script para limpiar datos de prueba huérfanos
require('dotenv').config();
const { sequelize } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function limpiarDatosPrueba() {
  console.log('\n========================================');
  console.log('  LIMPIEZA DE DATOS DE PRUEBA');
  console.log('========================================\n');

  try {
    const sqlFile = path.join(__dirname, 'cleanup-test-data.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('🔗 Conectando a la base de datos...\n');
    console.log('⚠️  ADVERTENCIA: Se eliminarán todos los datos de prueba\n');

    // Ejecutar limpieza
    const [results] = await sequelize.query(sql);

    console.log('✅ Limpieza completada\n');

    // Mostrar resumen
    if (Array.isArray(results) && results.length > 0) {
      console.log('📊 Resumen de datos restantes:');
      console.log('─'.repeat(50));
      results.forEach(row => {
        console.log(`${row.tabla.padEnd(25)} ${row.cantidad}`);
      });
      console.log('─'.repeat(50));
    }

    console.log('\n========================================');
    console.log('  LIMPIEZA COMPLETADA');
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nDetalles:', error);
    process.exit(1);
  }
}

limpiarDatosPrueba();
