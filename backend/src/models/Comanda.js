const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Comanda = sequelize.define('Comanda', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  mesaId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'mesa_id',
    references: {
      model: 'mesas',
      key: 'id'
    }
  },
  usuarioAtencionId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'usuario_atencion_id',
    references: {
      model: 'usuarios',
      key: 'id'
    }
  },
  fecha: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  estado: {
    type: DataTypes.STRING(50),
    defaultValue: 'abierta',
    validate: {
      isIn: [['abierta', 'cerrada', 'cancelada']]
    }
  },
  total: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  localId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'local_id',
    comment: 'Local al que pertenece la comanda'
  },
  cerradaAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'cerrada_at'
  }
}, {
  tableName: 'comandas'
});

module.exports = Comanda;
