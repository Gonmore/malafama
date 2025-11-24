require('dotenv').config();
const { Local, Proveedor, Producto, Comanda, Pedido } = require('../models');
const { testConnection } = require('../config/database');

const pad = (n) => n < 10 ? '0'+n : ''+n;
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

const run = async () => {
  await testConnection();
  const locales = await Local.findAll({ where: { activo: true } });
  if (!locales || locales.length === 0) {
    console.log('No active locals found, create a local first.');
    return process.exit(1);
  }

  for (const local of locales) {
    console.log('Seeding for local:', local.nombre || local.id);

    // create two providers if none exist
    const provCount = await Proveedor.count({ where: { localId: local.id } });
    if (provCount === 0) {
      const p1 = await Proveedor.create({ nombre: 'Distribuidora Demo A', telefono: '+58412345001', email: 'demo-a@prov.com', localId: local.id });
      const p2 = await Proveedor.create({ nombre: 'Distribuidora Demo B', telefono: '+58412345002', email: 'demo-b@prov.com', localId: local.id });

      // Create products for each provider
      const prod1 = await Producto.create({ nombre: 'Tomate Demo', precio: 10.00, costo: 4.00, proveedorId: p1.id, localId: local.id, activo: true });
      const prod2 = await Producto.create({ nombre: 'Lechuga Demo', precio: 8.00, costo: 3.50, proveedorId: p2.id, localId: local.id, activo: true });

      // Create a closed comanda with pedidos within last 7 days
      const fecha = new Date(); fecha.setDate(fecha.getDate()-3); // 3 days ago
      const comanda = await Comanda.create({ localId: local.id, estado: 'cerrada', total: 100.00, formaPago: 'efectivo', createdAt: fecha, updatedAt: fecha });
      await Pedido.create({ comandaId: comanda.id, productoId: prod1.id, cantidad: 5, precioUnitario: prod1.precio, subtotal: 5 * prod1.precio, estado: 'cerrada' });
      await Pedido.create({ comandaId: comanda.id, productoId: prod2.id, cantidad: 6, precioUnitario: prod2.precio, subtotal: 6 * prod2.precio, estado: 'cerrada' });

      console.log('Created demo providers + products + comanda for local', local.id);
    } else {
      console.log('Local already has providers, skipping creation');
    }
  }

  console.log('Seeding complete.');
  process.exit(0);
};

run().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
