const { Producto, Proveedor, CategoriaProducto } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { resolveLocalWhere, resolveAllowedLocalIds, assertLocalIdAllowed } = require('../utils/localScope');
const { resolveOperationalProductType } = require('../utils/productRouting');

// Helper: resolve or create categoriaId given a category name and localId
const resolveCategoriaId = async (nombre, localId) => {
  if (!nombre || !localId) return null;
  const clean = String(nombre).trim();
  if (!clean) return null;
  const [cat] = await CategoriaProducto.findOrCreate({
    where: { nombre: clean, localId },
    defaults: { nombre: clean, localId, activo: true }
  });
  if (!cat.activo) await cat.update({ activo: true });
  return cat.id;
};

// Listar todos los productos
const getAllProductos = async (req, res) => {
  try {
    const { activo, categoria, proveedorId, localId, tipo } = req.query;
    
    const where = {};
    if (activo !== undefined) where.activo = activo === 'true';
    if (categoria) where.categoria = categoria;
    if (proveedorId) where.proveedorId = proveedorId;
    try {
      const scoped = await resolveLocalWhere(req, localId);
      Object.assign(where, scoped.where);
    } catch (e) {
      return res.status(e.status || 403).json({ success: false, message: e.message });
    }
    if (tipo) where.tipo = tipo;

    const productos = await Producto.findAll({
      where,
      include: [{
        model: Proveedor,
        as: 'proveedor',
        attributes: ['id', 'nombre', 'esPropio']
      }],
      order: [['categoria', 'ASC'], ['nombre', 'ASC']]
    });

    res.json({
      success: true,
      data: productos
    });
  } catch (error) {
    console.error('Error en getAllProductos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener productos',
      error: error.message
    });
  }
};

// Obtener productos agrupados por categoría
const getProductosPorCategoria = async (req, res) => {
  try {
    const { activo, localId } = req.query;
    
    const where = {};
    if (activo !== undefined) where.activo = activo === 'true';
    try {
      const scoped = await resolveLocalWhere(req, localId);
      Object.assign(where, scoped.where);
    } catch (e) {
      return res.status(e.status || 403).json({ success: false, message: e.message });
    }

    const productos = await Producto.findAll({
      where,
      include: [{
        model: Proveedor,
        as: 'proveedor',
        attributes: ['id', 'nombre', 'esPropio']
      }],
      order: [['categoria', 'ASC'], ['nombre', 'ASC']]
    });

    // Agrupar productos por categoría
    const productosPorCategoria = productos.reduce((acc, producto) => {
      const categoria = producto.categoria || 'Sin categoría';
      
      if (!acc[categoria]) {
        acc[categoria] = [];
      }
      
      acc[categoria].push(producto);
      return acc;
    }, {});

    // Convertir a array con formato más amigable
    const resultado = Object.keys(productosPorCategoria).map(categoria => ({
      categoria,
      productos: productosPorCategoria[categoria],
      total: productosPorCategoria[categoria].length
    }));

    res.json({
      success: true,
      data: resultado,
      totalCategorias: resultado.length,
      totalProductos: productos.length
    });
  } catch (error) {
    console.error('Error en getProductosPorCategoria:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener productos por categoría',
      error: error.message
    });
  }
};

// Obtener producto por ID
const getProductoById = async (req, res) => {
  try {
    const { id } = req.params;

    const producto = await Producto.findByPk(id, {
      include: [{
        model: Proveedor,
        as: 'proveedor'
      }]
    });

    if (!producto) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    const allowedLocalIds = await resolveAllowedLocalIds(req);
    try {
      assertLocalIdAllowed(allowedLocalIds, producto.localId);
    } catch (e) {
      return res.status(e.status || 403).json({ success: false, message: e.message });
    }

    res.json({
      success: true,
      data: producto
    });
  } catch (error) {
    console.error('Error en getProductoById:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener producto',
      error: error.message
    });
  }
};

// Crear producto
const createProducto = async (req, res) => {
  try {
    const { nombre, descripcion, foto, precio, costo, proveedorId, categoria, tipo, localId } = req.body;

    const allowedLocalIds = await resolveAllowedLocalIds(req);
    const targetLocalId = localId || req.user?.localId || null;
    if (!targetLocalId) {
      return res.status(400).json({ success: false, message: 'localId es requerido' });
    }
    try {
      assertLocalIdAllowed(allowedLocalIds, targetLocalId);
    } catch (e) {
      return res.status(e.status || 403).json({ success: false, message: e.message });
    }

    // Verificar que el proveedor existe
    if (proveedorId) {
      const proveedor = await Proveedor.findByPk(proveedorId);
      if (!proveedor) {
        return res.status(404).json({
          success: false,
          message: 'Proveedor no encontrado'
        });
      }
    }

    const resolvedTipo = resolveOperationalProductType({ nombre, categoria, tipo });
    const categoriaId = await resolveCategoriaId(categoria, targetLocalId);

    const producto = await Producto.create({
      nombre,
      descripcion,
      foto,
      precio,
      costo,
      proveedorId,
      categoria,
      categoriaId,
      tipo: resolvedTipo,
      localId: targetLocalId
    });

    const productoCompleto = await Producto.findByPk(producto.id, {
      include: [{
        model: Proveedor,
        as: 'proveedor'
      }]
    });

    res.status(201).json({
      success: true,
      message: 'Producto creado exitosamente',
      data: productoCompleto
    });
  } catch (error) {
    console.error('Error en createProducto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear producto',
      error: error.message
    });
  }
};

// Crear múltiples productos (para scraping)
const createMultipleProductos = async (req, res) => {
  try {
    const { productos } = req.body;

    const allowedLocalIds = await resolveAllowedLocalIds(req);

    if (!Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de productos'
      });
    }

    const defaultLocalId = req.user?.localId || req.body.localId || null;
    const productosNormalizados = productos.map((p) => ({
      ...p,
      tipo: resolveOperationalProductType(p),
      localId: p.localId || defaultLocalId
    }));

    for (const p of productosNormalizados) {
      if (!p.localId) {
        return res.status(400).json({
          success: false,
          message: 'Cada producto debe incluir localId (o enviar localId por defecto)'
        });
      }
      try {
        assertLocalIdAllowed(allowedLocalIds, p.localId);
      } catch (e) {
        return res.status(e.status || 403).json({ success: false, message: e.message });
      }
    }

    // Resolve categoriaId for each product
    const productosConCategoria = await Promise.all(
      productosNormalizados.map(async (p) => ({
        ...p,
        categoriaId: await resolveCategoriaId(p.categoria, p.localId)
      }))
    );

    const productosCreados = await Producto.bulkCreate(productosConCategoria);

    res.status(201).json({
      success: true,
      message: `${productosCreados.length} productos creados exitosamente`,
      data: productosCreados
    });
  } catch (error) {
    console.error('Error en createMultipleProductos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear productos',
      error: error.message
    });
  }
};

// Actualizar producto
const updateProducto = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, foto, precio, costo, proveedorId, categoria, activo, tipo } = req.body;

    const allowedLocalIds = await resolveAllowedLocalIds(req);

    const producto = await Producto.findByPk(id);

    if (!producto) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    try {
      assertLocalIdAllowed(allowedLocalIds, producto.localId);
    } catch (e) {
      return res.status(e.status || 403).json({ success: false, message: e.message });
    }

    // Verificar proveedor si se está actualizando
    if (proveedorId && proveedorId !== producto.proveedorId) {
      const proveedor = await Proveedor.findByPk(proveedorId);
      if (!proveedor) {
        return res.status(404).json({
          success: false,
          message: 'Proveedor no encontrado'
        });
      }
    }

    const nextNombre = nombre || producto.nombre;
    const nextCategoria = categoria !== undefined ? categoria : producto.categoria;
    const nextTipo = tipo !== undefined ? tipo : producto.tipo;
    const nextCategoriaId = categoria !== undefined
      ? await resolveCategoriaId(categoria, producto.localId)
      : producto.categoriaId;

    await producto.update({
      nombre: nombre || producto.nombre,
      descripcion: descripcion !== undefined ? descripcion : producto.descripcion,
      foto: foto !== undefined ? foto : producto.foto,
      precio: precio || producto.precio,
      costo: costo || producto.costo,
      proveedorId: proveedorId !== undefined ? proveedorId : producto.proveedorId,
      categoria: categoria !== undefined ? categoria : producto.categoria,
      categoriaId: nextCategoriaId,
      activo: activo !== undefined ? activo : producto.activo,
      tipo: resolveOperationalProductType({ nombre: nextNombre, categoria: nextCategoria, tipo: nextTipo })
    });

    const productoActualizado = await Producto.findByPk(id, {
      include: [{
        model: Proveedor,
        as: 'proveedor'
      }]
    });

    res.json({
      success: true,
      message: 'Producto actualizado exitosamente',
      data: productoActualizado
    });
  } catch (error) {
    console.error('Error en updateProducto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar producto',
      error: error.message
    });
  }
};

// Actualizar proveedor y costo de producto (post-scraping)
const updateProductoProveedor = async (req, res) => {
  try {
    const { id } = req.params;
    const { proveedorId, costo } = req.body;

    const allowedLocalIds = await resolveAllowedLocalIds(req);

    const producto = await Producto.findByPk(id);

    if (!producto) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    try {
      assertLocalIdAllowed(allowedLocalIds, producto.localId);
    } catch (e) {
      return res.status(e.status || 403).json({ success: false, message: e.message });
    }

    // Verificar que el proveedor existe
    const proveedor = await Proveedor.findByPk(proveedorId);
    if (!proveedor) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    await producto.update({
      proveedorId,
      costo
    });

    const productoActualizado = await Producto.findByPk(id, {
      include: [{
        model: Proveedor,
        as: 'proveedor'
      }]
    });

    res.json({
      success: true,
      message: 'Proveedor y costo actualizados exitosamente',
      data: productoActualizado
    });
  } catch (error) {
    console.error('Error en updateProductoProveedor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar proveedor del producto',
      error: error.message
    });
  }
};

// Eliminar producto (soft delete)
const deleteProducto = async (req, res) => {
  try {
    const { id } = req.params;

    const allowedLocalIds = await resolveAllowedLocalIds(req);

    const producto = await Producto.findByPk(id);

    if (!producto) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
    }

    try {
      assertLocalIdAllowed(allowedLocalIds, producto.localId);
    } catch (e) {
      return res.status(e.status || 403).json({ success: false, message: e.message });
    }

    await producto.update({ activo: false });

    res.json({
      success: true,
      message: 'Producto desactivado exitosamente'
    });
  } catch (error) {
    console.error('Error en deleteProducto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar producto',
      error: error.message
    });
  }
};

// Obtener categorías únicas
const getCategorias = async (req, res) => {
  try {
    const { localId } = req.query;

    const where = {
      categoria: { [Op.ne]: null },
      activo: true
    };

    try {
      const scoped = await resolveLocalWhere(req, localId);
      Object.assign(where, scoped.where);
    } catch (e) {
      return res.status(e.status || 403).json({ success: false, message: e.message });
    }

    const categorias = await Producto.findAll({
      attributes: [
        'categoria',
        [sequelize.fn('COUNT', sequelize.col('id')), 'cantidad']
      ],
      where,
      group: ['categoria'],
      order: [['categoria', 'ASC']],
      raw: true
    });

    const categoriasGuardadas = where.localId
      ? await CategoriaProducto.findAll({
          attributes: ['id', 'nombre'],
          where: {
            localId: where.localId,
            activo: true
          },
          raw: true
        })
      : [];

    const porNombre = new Map();
    categoriasGuardadas.forEach((categoria) => {
      porNombre.set(categoria.nombre, {
        id: categoria.id,
        nombre: categoria.nombre,
        cantidad: 0
      });
    });
    categorias.forEach((categoria) => {
      const current = porNombre.get(categoria.categoria);
      porNombre.set(categoria.categoria, {
        id: current?.id || null,
        nombre: categoria.categoria,
        cantidad: parseInt(categoria.cantidad)
      });
    });

    res.json({
      success: true,
      data: Array.from(porNombre.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
    });
  } catch (error) {
    console.error('Error en getCategorias:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener categorías',
      error: error.message
    });
  }
};

// Crear una categoria para usarla aunque todavia no tenga productos
const createCategoria = async (req, res) => {
  try {
    const { nombre, localId } = req.body;
    const cleanNombre = String(nombre || '').trim();

    if (!cleanNombre) {
      return res.status(400).json({
        success: false,
        message: 'nombre es requerido'
      });
    }

    const allowedLocalIds = await resolveAllowedLocalIds(req);
    const targetLocalId = localId || req.user?.localId || null;
    if (!targetLocalId) {
      return res.status(400).json({ success: false, message: 'localId es requerido' });
    }
    try {
      assertLocalIdAllowed(allowedLocalIds, targetLocalId);
    } catch (e) {
      return res.status(e.status || 403).json({ success: false, message: e.message });
    }

    const [categoria] = await CategoriaProducto.findOrCreate({
      where: {
        localId: targetLocalId,
        nombre: cleanNombre
      },
      defaults: {
        localId: targetLocalId,
        nombre: cleanNombre,
        activo: true
      }
    });

    if (!categoria.activo) {
      await categoria.update({ activo: true });
    }

    res.status(201).json({
      success: true,
      message: 'Categoria creada exitosamente',
      data: {
        id: categoria.id,
        nombre: categoria.nombre,
        cantidad: 0
      }
    });
  } catch (error) {
    console.error('Error en createCategoria:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear categoria',
      error: error.message
    });
  }
};

// Renombrar una categoria en todos los productos del local
const renameCategoria = async (req, res) => {
  try {
    const { oldName, newName, localId } = req.body;
    const from = String(oldName || '').trim();
    const to = String(newName || '').trim();

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: 'oldName y newName son requeridos'
      });
    }

    if (from === to) {
      return res.json({
        success: true,
        message: 'Categoria sin cambios',
        data: { updated: 0 }
      });
    }

    const where = {
      categoria: from
    };

    try {
      const scoped = await resolveLocalWhere(req, localId);
      Object.assign(where, scoped.where);
    } catch (e) {
      return res.status(e.status || 403).json({ success: false, message: e.message });
    }

    const [updated] = await Producto.update(
      { categoria: to },
      { where }
    );

    const targetLocalId = where.localId || localId || req.user?.localId;
    if (targetLocalId) {
      const existingNew = await CategoriaProducto.findOne({
        where: {
          localId: targetLocalId,
          nombre: to
        }
      });

      if (!existingNew) {
        const existingOld = await CategoriaProducto.findOne({
          where: {
            localId: targetLocalId,
            nombre: from
          }
        });

        if (existingOld) {
          await existingOld.update({ nombre: to, activo: true });
        } else {
          await CategoriaProducto.create({ localId: targetLocalId, nombre: to, activo: true });
        }
      } else {
        await existingNew.update({ activo: true });
        await CategoriaProducto.destroy({
          where: {
            localId: targetLocalId,
            nombre: from
          }
        });
      }
    }

    res.json({
      success: true,
      message: `${updated} productos actualizados`,
      data: { updated, oldName: from, newName: to }
    });
  } catch (error) {
    console.error('Error en renameCategoria:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar categoria',
      error: error.message
    });
  }
};

module.exports = {
  getAllProductos,
  getProductoById,
  createProducto,
  createMultipleProductos,
  updateProducto,
  updateProductoProveedor,
  deleteProducto,
  getCategorias,
  createCategoria,
  renameCategoria,
  getProductosPorCategoria
};
