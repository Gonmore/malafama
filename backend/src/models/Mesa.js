const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Mesa = sequelize.define('Mesa', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  nombre: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  numero: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  ubicacion: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  capacidad: {
    type: DataTypes.INTEGER,
    defaultValue: 4
  },
  localId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'local_id',
    comment: 'Local al que pertenece la mesa'
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'mesas'
});

module.exports = Mesa;
