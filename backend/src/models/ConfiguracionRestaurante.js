const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ConfiguracionRestaurante = sequelize.define('ConfiguracionRestaurante', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  nombreRestaurante: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'nombre_restaurante'
  },
  adminId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'admin_id',
    references: {
      model: 'usuarios',
      key: 'id'
    }
  },
  cantidadMesas: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'cantidad_mesas'
  },
  menuUrl: {
    type: DataTypes.STRING(500),
    allowNull: true,
    field: 'menu_url'
  },
  scrapingCompletado: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'scraping_completado'
  },
  configuracionInicialCompletada: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'configuracion_inicial_completada'
  }
}, {
  tableName: 'configuracion_restaurante'
});

module.exports = ConfiguracionRestaurante;
