// Script para arreglar el total de comandas cerradas con total = 0
require('dotenv').config();
const { sequelize } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function arreglarTotales() {
  console.log('\n========================================');
  console.log('  ARREGLAR TOTALES DE COMANDAS');
  console.log('========================================\n');

  try {
    // Leer archivo SQL
    const sqlFile = path.join(__dirname, '20251121_fix_comandas_total.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');

    console.log('🔗 Conectando a la base de datos...\n');

    // Ejecutar SQL
    const [results] = await sequelize.query(sql);

    console.log('✅ Totales actualizados exitosamente\n');
    
    // Mostrar resultados si existen
    if (Array.isArray(results) && results.length > 0) {
      console.log('📊 Últimas 10 comandas cerradas:');
      console.log('─'.repeat(80));
      results.forEach(row => {
        console.log(`ID: ${row.id.slice(0, 8)}... | Total: $${row.total_comanda} | Fecha: ${row.cerrada_at?.toLocaleDateString() || 'N/A'}`);
      });
      console.log('─'.repeat(80));
    }

    console.log('\n========================================');
    console.log('  PROCESO COMPLETADO');
    console.log('========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('\nDetalles:', error);
    process.exit(1);
  }
}

arreglarTotales();
