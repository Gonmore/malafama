const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Local = sequelize.define('Local', {
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
    type: DataTypes.TEXT
  },
  direccion: {
    type: DataTypes.STRING(500)
  },
  telefono: {
    type: DataTypes.STRING(50)
  },
  email: {
    type: DataTypes.STRING(255)
  },
  logo: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Logo del local en formato Base64'
  },
  qr: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'QR de pago del local (Base64 o URL)'
  },
  moneda: {
    type: DataTypes.STRING(10),
    defaultValue: 'Bs',
    allowNull: false,
    comment: 'Moneda del local (Bs, $, S/, etc)'
  },
  plan: {
    type: DataTypes.STRING(50),
    defaultValue: 'gratuito',
    validate: {
      isIn: [['gratuito', 'basico', 'premium', 'enterprise']]
    }
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  usuarioPropietarioId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'usuario_propietario_id'
  }
}, {
  tableName: 'locales',
  underscored: true
});

module.exports = Local;
