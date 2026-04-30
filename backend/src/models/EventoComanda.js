const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EventoComanda = sequelize.define('EventoComanda', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  firestoreId: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'firestore_id',
    comment: 'ID del documento en Firestore (ej: "2026-03-13")'
  },
  titulo: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  fecha: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  horaApertura: {
    type: DataTypes.STRING(10),
    allowNull: true,
    field: 'hora_apertura'
  },
  horaInicio: {
    type: DataTypes.STRING(10),
    allowNull: true,
    field: 'hora_inicio'
  },
  estado: {
    type: DataTypes.STRING(20),
    defaultValue: 'activo',
    validate: { isIn: [['activo', 'finalizado', 'cancelado']] }
  },
  localId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'local_id'
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Metadata adicional del evento (logoUrl, resumen, sectores, etc)'
  }
}, {
  tableName: 'eventos_comanda',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['firestore_id'], unique: true },
    { fields: ['fecha'] }
  ]
});

module.exports = EventoComanda;
