const { Pool } = require('pg');
require('dotenv').config();

async function fixTipos() {
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  const patterns = [
    'cerveza', 'fanta', 'coca', 'coke', 'fernet', 'gin', 'tonic', 'whisky', 'vodka', 'ron', 'cola', 'jugo', 'agua', 'coct', 'cocktail', 'martini', 'capita', 'capital', 'tronco', 'huari', 'fernet con coca', 'capital collins'
  ];

  try {
    const client = await pool.connect();

    console.log('Buscando productos con tipo=\'otros\' que coinciden con patrones de bebida...');

    // Build WHERE clause for the ILIKE checks
    const ilikeClauses = patterns
      .map((p, i) => `LOWER(nombre) LIKE $${i + 1}`)
      .join(' OR ');

    const params = patterns.map(p => `%${p.toLowerCase()}%`);

    const selectSql = `
      SELECT id, nombre, tipo, local_id
      FROM productos
      WHERE tipo = 'otros' AND (${ilikeClauses})
    `;

    const result = await client.query(selectSql, params);

    if (result.rowCount === 0) {
      console.log('No se encontraron coincidencias. Ningún producto actualizado.');
      client.release();
      await pool.end();
      return;
    }

    console.log(`Encontrados ${result.rowCount} producto(s) candidates:`);
    result.rows.forEach(r => console.log(`  - ${r.id} : ${r.nombre} (local: ${r.local_id})`));

    const ids = result.rows.map(r => r.id);

    // Update tipos to 'bebida'
    const updateSql = `UPDATE productos SET tipo = 'bebida' WHERE id = ANY($1::uuid[])`;
    const updateRes = await client.query(updateSql, [ids]);

    console.log(`Actualizados ${updateRes.rowCount} producto(s) a tipo='bebida'.`);

    client.release();
    await pool.end();
  } catch (err) {
    console.error('Error al ejecutar script:', err);
    process.exit(1);
  }
}

fixTipos();
