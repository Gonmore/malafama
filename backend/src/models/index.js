const Usuario = require('./Usuario');
const Local = require('./Local');
const Proveedor = require('./Proveedor');
const Producto = require('./Producto');
const Mesa = require('./Mesa');
const MesaAsignada = require('./MesaAsignada');
const Comanda = require('./Comanda');
const Pedido = require('./Pedido');
const ConfiguracionRestaurante = require('./ConfiguracionRestaurante');
const ReporteDiario = require('./ReporteDiario');
const ScheduledReport = require('./ScheduledReport');
const PagoProveedor = require('./PagoProveedor');

// Definir relaciones

// Usuario - Local (1:N) - Un admin puede tener múltiples locales
Usuario.hasMany(Local, {
  foreignKey: 'usuarioPropietarioId',
  as: 'locales'
});
Local.belongsTo(Usuario, {
  foreignKey: 'usuarioPropietarioId',
  as: 'propietario'
});

// Local - Usuario (1:N) - Empleados del local
Local.hasMany(Usuario, {
  foreignKey: 'localId',
  as: 'empleados'
});
Usuario.belongsTo(Local, {
  foreignKey: 'localId',
  as: 'local'
});

// Usuario - Proveedor (1:1)
Usuario.hasOne(Proveedor, {
  foreignKey: 'usuarioId',
  as: 'proveedor'
});
Proveedor.belongsTo(Usuario, {
  foreignKey: 'usuarioId',
  as: 'usuario'
});

// Local - Proveedores (1:N)
Local.hasMany(Proveedor, {
  foreignKey: 'localId',
  as: 'proveedores'
});
Proveedor.belongsTo(Local, {
  foreignKey: 'localId',
  as: 'local'
});

// Local - Productos (1:N)
Local.hasMany(Producto, {
  foreignKey: 'localId',
  as: 'productos'
});
Producto.belongsTo(Local, {
  foreignKey: 'localId',
  as: 'local'
});

// Local - Comandas (1:N)
Local.hasMany(Comanda, {
  foreignKey: 'localId',
  as: 'comandas'
});
Comanda.belongsTo(Local, {
  foreignKey: 'localId',
  as: 'local'
});

// Local - ReportesDiarios (1:N)
Local.hasMany(ReporteDiario, {
  foreignKey: 'localId',
  as: 'reportesDiarios'
});
ReporteDiario.belongsTo(Local, {
  foreignKey: 'localId',
  as: 'local'
});

// Local - ScheduledReports (1:N)
Local.hasMany(ScheduledReport, {
  foreignKey: 'localId',
  as: 'schedules'
});
ScheduledReport.belongsTo(Local, {
  foreignKey: 'localId',
  as: 'local'
});

// Proveedor - Productos (1:N)
Proveedor.hasMany(Producto, {
  foreignKey: 'proveedorId',
  as: 'productos'
});
Producto.belongsTo(Proveedor, {
  foreignKey: 'proveedorId',
  as: 'proveedor'
});

// Proveedor - PagosProveedor (1:N)
Proveedor.hasMany(PagoProveedor, {
  foreignKey: 'proveedor_id',
  as: 'pagos'
});
PagoProveedor.belongsTo(Proveedor, {
  foreignKey: 'proveedor_id',
  as: 'proveedor'
});

// Local - PagosProveedor (1:N)
Local.hasMany(PagoProveedor, {
  foreignKey: 'local_id',
  as: 'pagosProveedores'
});
PagoProveedor.belongsTo(Local, {
  foreignKey: 'local_id',
  as: 'local'
});

// Usuario - PagosProveedor (1:N)
Usuario.hasMany(PagoProveedor, {
  foreignKey: 'creado_por',
  as: 'pagosCreados'
});
PagoProveedor.belongsTo(Usuario, {
  foreignKey: 'creado_por',
  as: 'creador'
});

// Local - Mesas (1:N)
Local.hasMany(Mesa, {
  foreignKey: 'localId',
  as: 'mesas'
});
Mesa.belongsTo(Local, {
  foreignKey: 'localId',
  as: 'local'
});

// Mesas asignadas - Usuarios (N:M) - asignación de meseros a mesas
Usuario.belongsToMany(Mesa, {
  through: MesaAsignada,
  foreignKey: 'usuarioId',
  otherKey: 'mesaId',
  as: 'mesasAsignadas'
});
Mesa.belongsToMany(Usuario, {
  through: MesaAsignada,
  foreignKey: 'mesaId',
  otherKey: 'usuarioId',
  as: 'usuariosAsignados'
});

// Mesa - Comandas (1:N)
Mesa.hasMany(Comanda, {
  foreignKey: 'mesaId',
  as: 'comandas'
});
Comanda.belongsTo(Mesa, {
  foreignKey: 'mesaId',
  as: 'mesa'
});

// Usuario - Comandas (1:N) - Usuario de atención
Usuario.hasMany(Comanda, {
  foreignKey: 'usuarioAtencionId',
  as: 'comandas'
});
Comanda.belongsTo(Usuario, {
  foreignKey: 'usuarioAtencionId',
  as: 'usuarioAtencion'
});

// Comanda - Pedidos (1:N)
Comanda.hasMany(Pedido, {
  foreignKey: 'comandaId',
  as: 'pedidos'
});
Pedido.belongsTo(Comanda, {
  foreignKey: 'comandaId',
  as: 'comanda'
});

// Producto - Pedidos (1:N)
Producto.hasMany(Pedido, {
  foreignKey: 'productoId',
  as: 'pedidos'
});
Pedido.belongsTo(Producto, {
  foreignKey: 'productoId',
  as: 'producto'
});

// Usuario - ConfiguracionRestaurante (1:1)
Usuario.hasOne(ConfiguracionRestaurante, {
  foreignKey: 'adminId',
  as: 'configuracion'
});
ConfiguracionRestaurante.belongsTo(Usuario, {
  foreignKey: 'adminId',
  as: 'admin'
});

module.exports = {
  Usuario,
  Local,
  Proveedor,
  Producto,
  Mesa,
  MesaAsignada,
  Comanda,
  Pedido,
  ConfiguracionRestaurante,
  ReporteDiario,
  ScheduledReport,
  PagoProveedor
};
