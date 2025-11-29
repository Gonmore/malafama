const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PagoProveedor = sequelize.define('PagoProveedor', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  proveedor_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'proveedores',
      key: 'id'
    }
  },
  local_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'locales',
      key: 'id'
    }
  },
  fecha_inicio: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Fecha de inicio del período pagado'
  },
  fecha_fin: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Fecha de fin del período pagado'
  },
  monto_pagado: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    comment: 'Monto total pagado al proveedor'
  },
  comprobante_url: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'URL o base64 de la imagen del comprobante'
  },
  detalle: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Detalle de productos incluidos en el pago'
  },
  observaciones: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  creado_por: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'usuarios',
      key: 'id'
    }
  }
}, {
  tableName: 'pagos_proveedores',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = PagoProveedor;
