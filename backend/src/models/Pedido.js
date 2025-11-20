const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Pedido = sequelize.define('Pedido', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  comandaId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'comanda_id',
    references: {
      model: 'comandas',
      key: 'id'
    }
  },
  productoId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'producto_id',
    references: {
      model: 'productos',
      key: 'id'
    }
  },
  cantidad: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      min: 1
    }
  },
  precioUnitario: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'precio_unitario'
  },
  subtotal: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  estado: {
    type: DataTypes.STRING(50),
    defaultValue: 'pendiente',
    validate: {
      isIn: [['pendiente', 'en_preparacion', 'listo', 'entregado', 'cancelado']]
    }
  },
  notas: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  listoAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'listo_at'
  }
}, {
  tableName: 'pedidos',
  hooks: {
    beforeSave: (pedido) => {
      // Calcular subtotal automáticamente
      pedido.subtotal = pedido.cantidad * pedido.precioUnitario;
    }
  }
});

module.exports = Pedido;
