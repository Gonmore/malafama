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
    } catch (e) {
      console.error('Error en reportes scheduler:', e);
    }
  }, 60 * 1000);
};

module.exports = {
  scheduleDailyReports
};
