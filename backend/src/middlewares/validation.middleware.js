const Joi = require('joi');

// Middleware para validar datos con Joi
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Errores de validación',
        errors
      });
    }

    next();
  };
};

// Esquemas de validación comunes

// Usuario
const usuarioSchemas = {
  create: Joi.object({
    nombre: Joi.string().min(3).max(255).required(),
    email: Joi.string().email({ tlds: { allow: false } }).required(),
    password: Joi.string().min(6).required(),
    tipo: Joi.string().valid('admin', 'atencion', 'supervisor', 'cocina', 'bar', 'proveedor', 'platform_admin').required()
  }),
  update: Joi.object({
    nombre: Joi.string().min(3).max(255),
    email: Joi.string().email({ tlds: { allow: false } }),
    password: Joi.string().min(6),
    tipo: Joi.string().valid('admin', 'atencion', 'supervisor', 'cocina', 'bar', 'proveedor', 'platform_admin'),
    activo: Joi.boolean()
  }),
  login: Joi.object({
    email: Joi.string().email({ tlds: { allow: false } }).required(),
    password: Joi.string().required()
  })
};

// Producto
const productoSchemas = {
  create: Joi.object({
    nombre: Joi.string().min(2).max(255).required(),
    descripcion: Joi.string().allow('', null),
    foto: Joi.string().uri().allow('', null),
    precio: Joi.number().min(0).required(),
    costo: Joi.number().min(0).required(),
    proveedorId: Joi.string().uuid().allow(null),
    categoria: Joi.string().max(100).allow('', null),
    tipo: Joi.string().valid('comida', 'bebida', 'otros'),
    localId: Joi.string().uuid().allow(null)
  }),
  update: Joi.object({
    nombre: Joi.string().min(2).max(255),
    descripcion: Joi.string().allow('', null),
    foto: Joi.string().uri().allow('', null),
    precio: Joi.number().min(0),
    costo: Joi.number().min(0),
    proveedorId: Joi.string().uuid().allow(null),
    categoria: Joi.string().max(100).allow('', null),
    tipo: Joi.string().valid('comida', 'bebida', 'otros'),
    activo: Joi.boolean()
  })
};

// Mesa
const mesaSchemas = {
  create: Joi.object({
    nombre: Joi.string().max(50).required(),
    numero: Joi.number().integer().min(1).required(),
    ubicacion: Joi.string().max(255).allow('', null),
    capacidad: Joi.number().integer().min(1).default(4),
    localId: Joi.string().uuid().allow(null)
  }),
  update: Joi.object({
    nombre: Joi.string().max(50),
    numero: Joi.number().integer().min(1),
    ubicacion: Joi.string().max(255).allow('', null),
    capacidad: Joi.number().integer().min(1),
    activo: Joi.boolean()
  })
};

// Comanda
const comandaSchemas = {
  create: Joi.object({
    mesaId: Joi.string().uuid().required()
    // allow optionally to include pedidos and force flag when creating comanda
    ,pedidos: Joi.array().items(
      Joi.object({
        productoId: Joi.string().uuid().required(),
        cantidad: Joi.number().integer().min(1).required(),
        notas: Joi.string().allow('', null)
      })
    ).min(1).optional(),
    forzar: Joi.boolean().optional()
  }),
  addPedidos: Joi.object({
    pedidos: Joi.array().items(
      Joi.object({
        productoId: Joi.string().uuid().required(),
        cantidad: Joi.number().integer().min(1).required(),
        notas: Joi.string().allow('', null)
      })
    ).min(1).required()
  })
};

// Pedido
const pedidoSchemas = {
  updateEstado: Joi.object({
    estado: Joi.string().valid('pendiente', 'en_preparacion', 'listo', 'entregado').required()
  })
};

// Proveedor
const proveedorSchemas = {
  create: Joi.object({
    nombre: Joi.string().min(2).max(255).required(),
    contacto: Joi.string().max(255).allow('', null),
    telefono: Joi.string().max(50).allow('', null),
    email: Joi.string().email({ tlds: { allow: false } }).allow('', null),
    esPropio: Joi.boolean().default(false),
    usuarioId: Joi.string().uuid().allow(null),
    localId: Joi.string().uuid().allow(null)
  }),
  update: Joi.object({
    nombre: Joi.string().min(2).max(255),
    contacto: Joi.string().max(255).allow('', null),
    telefono: Joi.string().max(50).allow('', null),
    email: Joi.string().email({ tlds: { allow: false } }).allow('', null),
    esPropio: Joi.boolean(),
    usuarioId: Joi.string().uuid().allow(null)
  })
};

// Configuración
const configSchemas = {
  create: Joi.object({
    nombreRestaurante: Joi.string().min(2).max(255).required(),
    cantidadMesas: Joi.number().integer().min(1).required(),
    menuUrl: Joi.string().uri().allow('', null)
  })
};

module.exports = {
  validate,
  usuarioSchemas,
  productoSchemas,
  mesaSchemas,
  comandaSchemas,
  pedidoSchemas,
  proveedorSchemas,
  configSchemas
};
