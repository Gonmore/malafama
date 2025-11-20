const { Pool } = require('pg');
require('dotenv').config();

async function addTipoColumn() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    console.log('Conectando a la base de datos...');
    const client = await pool.connect();

    // Crear tipo ENUM si no existe
    console.log('Creando tipo ENUM tipo_producto...');
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE tipo_producto AS ENUM ('comida', 'bebida', 'otros');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    // Agregar columna tipo a productos
    console.log('Agregando columna tipo a tabla productos...');
    await client.query(`
      ALTER TABLE productos 
      ADD COLUMN IF NOT EXISTS tipo tipo_producto DEFAULT 'otros';
    `);

    // Actualizar productos existentes basándose en categoría
    console.log('Actualizando productos existentes...');
    
    // Bebidas → tipo bebida
    await client.query(`
      UPDATE productos 
      SET tipo = 'bebida' 
      WHERE categoria ILIKE '%bebida%' 
         OR categoria ILIKE '%cerveza%'
         OR categoria ILIKE '%vino%'
         OR categoria ILIKE '%coctel%'
         OR categoria ILIKE '%refresco%'
         OR categoria ILIKE '%jugo%';
    `);

    // Comida → tipo comida
    await client.query(`
      UPDATE productos 
      SET tipo = 'comida' 
      WHERE categoria ILIKE '%comida%'
         OR categoria ILIKE '%plato%'
         OR categoria ILIKE '%entrada%'
         OR categoria ILIKE '%postre%'
         OR categoria ILIKE '%snack%'
         OR (tipo = 'otros' AND categoria IS NOT NULL);
    `);

    console.log('✅ Migración completada exitosamente');
    
    // Mostrar resumen
    const result = await client.query(`
      SELECT tipo, COUNT(*) as cantidad 
      FROM productos 
      GROUP BY tipo 
      ORDER BY tipo;
    `);
    
    console.log('\n📊 Resumen de productos por tipo:');
    result.rows.forEach(row => {
      console.log(`   ${row.tipo}: ${row.cantidad}`);
    });

    client.release();
    await pool.end();
  } catch (error) {
    console.error('❌ Error en la migración:', error);
    process.exit(1);
  }
}

addTipoColumn();
