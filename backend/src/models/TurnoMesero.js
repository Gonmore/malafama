const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TurnoMesero = sequelize.define('TurnoMesero', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  eventoId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'evento_id',
    references: { model: 'eventos_comanda', key: 'id' }
  },
  meseroId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'mesero_id',
    references: { model: 'usuarios', key: 'id' }
  },
  localId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'local_id'
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'turnos_mesero',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['evento_id', 'mesero_id'], unique: true }
  ]
});

module.exports = TurnoMesero;
