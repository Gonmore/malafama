const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Producto = sequelize.define('Producto', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  nombre: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  foto: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  precio: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  costo: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: 0
    }
  },
  proveedorId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'proveedor_id',
    references: {
      model: 'proveedores',
      key: 'id'
    }
  },
  localId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'local_id',
    comment: 'Local al que pertenece el producto'
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  categoria: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  tipo: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'otros',
    comment: 'Tipo de producto para routing: comida→cocina, bebida→bar'
  },
  categoriaId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'categoria_id',
    references: {
      model: 'categorias_productos',
      key: 'id'
    }
  }
}, {
  tableName: 'productos'
});

module.exports = Producto;
