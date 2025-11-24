require('dotenv').config();

const { Local, ReporteDiario } = require('../models');
const { testConnection } = require('../config/database');

const DAYS_BACK = 21; // scan last N days

const pad = (n) => n < 10 ? '0'+n : ''+n;

const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;

const makeSampleData = (fechaStr) => {
  const inicio = new Date(fechaStr + 'T06:00:00');
  const fin = new Date(inicio);
  fin.setDate(fin.getDate()+1);

  // small synthetic snapshot
  return {
    inicioDia: inicio,
    finDia: fin,
    usuarios: [
      { id: 'u-1', nombre: 'María', tipo: 'atencion', comandas: [{ id: 'c1', total: 120.00 }], totalUsuario: 120.00 },
      { id: 'u-2', nombre: 'Carlos', tipo: 'atencion', comandas: [{ id: 'c2', total: 240.50 }], totalUsuario: 240.5 }
    ],
    totales: { totalDia: '360.50', totalEfectivo: '160.50', totalQr: '200.00', totalMixto: '0.00' }
  };
};

const run = async () => {
  await testConnection();

  const locales = await Local.findAll({ where: { activo: true }, attributes: ['id','nombre'] });
  if (!locales || locales.length === 0) {
    console.log('No hay locales activos en la base de datos. Crea algunos locales antes de usar este script.');
    return process.exit(1);
  }

  const today = new Date();

  for (let i = 0; i < DAYS_BACK; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dow = d.getDay(); // 0 Sun - 6 Sat
    // target Fridays (5) and Saturdays (6)
    if (dow !== 5 && dow !== 6) continue;

    const fecha = isoDate(d);
    // create a report for every active local
    for (const local of locales) {
      const exists = await ReporteDiario.findOne({ where: { localId: local.id, fecha } });
      if (exists) {
        console.log(`SKIP ${local.nombre} ${fecha} (already exists)`);
        continue;
      }

      const payload = { localId: local.id, fecha, data: makeSampleData(fecha) };
      await ReporteDiario.create(payload);
      console.log(`Created report for ${local.nombre} @ ${fecha}`);
    }
  }

  console.log('Seed complete.');
  process.exit(0);
};

run().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
