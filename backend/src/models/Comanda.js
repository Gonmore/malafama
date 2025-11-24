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
  formaPago: {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'forma_pago',
    validate: {
      isIn: [['efectivo', 'qr', 'mixto']]
    },
    comment: 'Método de pago utilizado: efectivo, qr o mixto'
  },
  cantidadEfectivo: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'cantidad_efectivo',
    comment: 'Monto pagado en efectivo (para modo mixto)'
  },
  cantidadQr: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    field: 'cantidad_qr',
    comment: 'Monto pagado por QR (para modo mixto)'
  },
  comprobante: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Ruta o Base64 de la imagen del comprobante de pago (para QR y mixto)'
  },
  cerradaAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'cerrada_at'
  },
  createdAt: {
    type: DataTypes.DATE,
    field: 'created_at'
  },
  updatedAt: {
    type: DataTypes.DATE,
    field: 'updated_at'
  }
}, {
  tableName: 'comandas',
  timestamps: true
});

module.exports = Comanda;
