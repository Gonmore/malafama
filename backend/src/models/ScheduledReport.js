const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ScheduledReport = sequelize.define('ScheduledReport', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  localId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  nombre: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Reporte programado'
  },
  frecuencia: {
    type: DataTypes.ENUM('daily','weekly','monthly','custom'),
    allowNull: false,
    defaultValue: 'daily'
  },
  // time in HH:MM format (server local time)
  tiempo: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: '06:00'
  },
  // weekday 0(Sunday)-6(Saturday) for weekly
  diaSemana: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  // day of month 1-31 for monthly
  diaMes: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  formato: {
    type: DataTypes.ENUM('csv','pdf','both'),
    allowNull: false,
    defaultValue: 'csv'
  },
  destinatarios: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastRunAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  underscored: true,
  tableName: 'scheduled_reports'
});

module.exports = ScheduledReport;
