const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ReporteDiario = sequelize.define('ReporteDiario', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  localId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'local_id'
  },
  fecha: {
    // business day date in YYYY-MM-DD (stored as date)
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  tipo: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'diario'
  },
  data: {
    type: DataTypes.JSONB,
    allowNull: false,
    comment: 'JSON con el snapshot del reporte (comandas agrupadas, totales, etc)'
  }
}, {
  tableName: 'reportes_diarios',
  underscored: true,
  timestamps: true
});

module.exports = ReporteDiario;
