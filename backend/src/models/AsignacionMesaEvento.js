const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AsignacionMesaEvento = sequelize.define('AsignacionMesaEvento', {
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
  mesaId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'mesa_id',
    references: { model: 'mesas', key: 'id' }
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
  }
}, {
  tableName: 'asignaciones_mesa_evento',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['evento_id', 'mesa_id'], unique: true },
    { fields: ['evento_id', 'mesero_id'] }
  ]
});

module.exports = AsignacionMesaEvento;
