/**
 * Script para actualizar el tipo de dato de la columna 'logo' en la tabla 'locales'
 * De VARCHAR(500) a TEXT para soportar imágenes Base64
 */

require('dotenv').config();
const { sequelize } = require('../src/config/database');

async function updateLogoColumn() {
  try {
    console.log('🔄 Actualizando columna logo en tabla locales...');

    // Cambiar tipo de dato de la columna logo
    await sequelize.query(`
      ALTER TABLE locales 
      ALTER COLUMN logo TYPE TEXT;
    `);

    console.log('✅ Columna logo actualizada exitosamente a tipo TEXT');
    console.log('📝 Ahora soporta imágenes Base64 de cualquier tamaño razonable');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error al actualizar columna:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Ejecutar migración
updateLogoColumn();
