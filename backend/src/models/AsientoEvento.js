const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AsientoEvento = sequelize.define('AsientoEvento', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  seatId: {
    type: DataTypes.STRING(20),
    allowNull: false,
    field: 'seat_id',
    comment: 'ej: "3-A"'
  },
  mesaNum: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'mesa_num'
  },
  letra: {
    type: DataTypes.STRING(1),
    allowNull: false
  },
  estado: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'disponible',
    validate: {
      isIn: [['disponible', 'vendido', 'cortesia', 'reservado_por_pagar']]
    }
  },
  eventoId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'evento_id',
    references: { model: 'eventos_comanda', key: 'id' }
  },
  codigoTicket: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'codigo_ticket'
  },
  tipoOcupacion: {
    type: DataTypes.STRING(30),
    allowNull: true,
    field: 'tipo_ocupacion'
  },
  precioVendido: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'precio_vendido'
  }
}, {
  tableName: 'asientos_evento',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['seat_id', 'evento_id'], unique: true },
    { fields: ['mesa_num', 'evento_id'] }
  ]
});

module.exports = AsientoEvento;
