const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MesaAsignada = sequelize.define('MesaAsignada', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  usuarioId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'usuario_id'
  },
  mesaId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'mesa_id'
  }
}, {
  tableName: 'mesas_asignadas'
});

module.exports = MesaAsignada;
