const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Proveedor = sequelize.define('Proveedor', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  nombre: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  contacto: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  telefono: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isEmail: {
        msg: 'Debe ser un email válido'
      }
    },
    set(value) {
      // Convertir string vacío a null para evitar error de validación
      this.setDataValue('email', value === '' ? null : value);
    }
  },
  esPropio: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'es_propio'
  },
  usuarioId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'usuario_id',
    references: {
      model: 'usuarios',
      key: 'id'
    }
  },
  localId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'local_id',
    comment: 'Local al que pertenece el proveedor'
  }
}, {
  tableName: 'proveedores'
});

module.exports = Proveedor;
