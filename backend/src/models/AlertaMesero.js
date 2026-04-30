const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AlertaMesero = sequelize.define('AlertaMesero', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  tipo: {
    type: DataTypes.STRING(20),
    allowNull: false,
    validate: { isIn: [['llamada', 'listo']] },
    comment: 'llamada = cliente llama al mesero; listo = pedido listo para entregar'
  },
  mesaId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'mesa_id',
    references: { model: 'mesas', key: 'id' }
  },
  meseroId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'mesero_id',
    comment: 'Mesero asignado a la mesa'
  },
  eventoId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'evento_id'
  },
  comandaId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'comanda_id'
  },
  localId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'local_id'
  },
  estado: {
    type: DataTypes.STRING(20),
    defaultValue: 'activa',
    validate: { isIn: [['activa', 'resuelta']] }
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'resolved_at'
  }
}, {
  tableName: 'alertas_mesero',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['mesero_id', 'estado'] },
    { fields: ['mesa_id', 'estado'] }
  ]
});

module.exports = AlertaMesero;
