const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CategoriaProducto = sequelize.define('CategoriaProducto', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  nombre: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  localId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'local_id'
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'categorias_productos',
  indexes: [
    {
      unique: true,
      fields: ['local_id', 'nombre']
    }
  ]
});

module.exports = CategoriaProducto;
