const { Local, ReporteDiario } = require('../models');
const { generarYGuardarReporte } = require('../controllers/reporte.controller');

// Scheduler que corre cada minuto y genera reportes diarios a las 06:00 (hora del servidor)
const scheduleDailyReports = () => {
  console.log('✅ Reportes Scheduler iniciado (comprobando cada minuto)');

  setInterval(async () => {
    try {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();

      // Ejecutar una vez cuando sea 06:00 (permitir ventana de 0-1 minuto)
      if (hour === 6 && minute <= 1) {
        // Queremos generar el reporte del día que acaba de terminar: fechaTarget = ayer (start date)
        const target = new Date(now);
        target.setDate(target.getDate() - 1);
        const fechaTarget = target.toISOString().split('T')[0];

        console.log(`⏰ Es 06:00 - generando reportes diarios para fecha ${fechaTarget}`);

        // Cargar todos los locales activos
        const locales = await Local.findAll({ where: { activo: true }, attributes: ['id','nombre'] });

        for (const local of locales) {
          try {
            const exists = await ReporteDiario.findOne({ where: { localId: local.id, fecha: fechaTarget } });
            if (exists) {
              console.log(` - Local ${local.nombre} (${local.id}) → reporte ya existe para ${fechaTarget}`);
              continue;
            }

            // Generar y guardar
            await generarYGuardarReporte(local.id, fechaTarget);
            console.log(` - Local ${local.nombre} (${local.id}) → reporte creado para ${fechaTarget}`);
          } catch (err) {
            console.error(`Error generando reporte para local ${local.id}:`, err.message || err);
          }
        }
      }

      // Also check scheduled_reports table for custom schedules
      try {
        const { ScheduledReport } = require('../models');
        const schedules = await ScheduledReport.findAll({ where: { activo: true } });

        for (const s of schedules) {
          try {
            const now = new Date();
            const [hhStr, mmStr] = (s.tiempo || '06:00').split(':');
            const hh = parseInt(hhStr || '0', 10);
            const mm = parseInt(mmStr || '0', 10);

            // run only if hour and minute match (allow a 1-minute window)
            if (now.getHours() === hh && Math.abs(now.getMinutes() - mm) <= 1) {
              // ensure not run recently
              const last = s.lastRunAt ? new Date(s.lastRunAt) : null;
              if (last) {
                // if last run is within last 30 minutes, skip
                const diff = (now.getTime() - last.getTime()) / 1000;
                if (diff < 60 * 30) continue;
              }

              // frequency check
              if (s.frecuencia === 'daily') {
                // run for previous business day
                const target = new Date(now);
                target.setDate(target.getDate() - 1);
                const fechaTarget = target.toISOString().split('T')[0];
                console.log(`🔁 Programado: ejecutando schedule ${s.id} (${s.nombre}) para local ${s.localId} fecha ${fechaTarget}`);
                await generarYGuardarReporte(s.localId, fechaTarget);
                s.lastRunAt = now;
                await s.save();
              } else if (s.frecuencia === 'weekly') {
                // check dayOfWeek
                if (s.diaSemana == null) continue;
                if (now.getDay() === s.diaSemana) {
                  const target = new Date(now);
                  target.setDate(target.getDate() - 1);
                  const fechaTarget = target.toISOString().split('T')[0];
                  console.log(`🔁 Programado (weekly): schedule ${s.id} for ${fechaTarget}`);
                  await generarYGuardarReporte(s.localId, fechaTarget);
                  s.lastRunAt = now;
                  await s.save();
                }
              } else if (s.frecuencia === 'monthly') {
                if (s.diaMes == null) continue;
                if (now.getDate() === s.diaMes) {
                  const target = new Date(now);
                  target.setDate(target.getDate() - 1);
                  const fechaTarget = target.toISOString().split('T')[0];
                  console.log(`🔁 Programado (monthly): schedule ${s.id} for ${fechaTarget}`);
                  await generarYGuardarReporte(s.localId, fechaTarget);
                  s.lastRunAt = now;
                  await s.save();
                }
              } else {
                // custom/crons not implemented yet
              }
            }
          } catch (err) {
            console.error('Error running scheduled report item:', err.message || err);
          }
        }
      } catch (err) {
        console.error('Error checking scheduled_reports:', err.message || err);
      }
    } catch (e) {
      console.error('Error en reportes scheduler:', e);
    }
  }, 60 * 1000);
};

module.exports = {
  scheduleDailyReports
};
