const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Tenant = sequelize.define(
  'Tenant',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    nombre: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    adminUsuarioId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: 'admin_usuario_id',
    },
    referenciaTenantId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'referencia_tenant_id',
    },
    esReferencia: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'es_referencia',
    },
    planDefault: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'gratuito',
      field: 'plan_default',
    },
    monedaDefault: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'Bs',
      field: 'moneda_default',
    },
    suscripcionHasta: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'suscripcion_hasta',
    },
    maxLocales: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: 'max_locales',
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    createdByPlatformAdminId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'created_by_platform_admin_id',
    },
  },
  {
    tableName: 'tenants',
    underscored: true,
  }
);

module.exports = Tenant;
