const { Producto, Proveedor } = require('../models');
const { Op } = require('sequelize');

// Listar todos los productos
const getAllProductos = async (req, res) => {
  try {
    const { activo, categoria, proveedorId, localId, tipo } = req.query;
    
    const where = {};
    if (activo !== undefined) where.activo = activo === 'true';
    if (categoria) where.categoria = categoria;
    if (proveedorId) where.proveedorId = proveedorId;
    if (localId) where.localId = localId;
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
    if (localId) where.localId = localId;

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

    const producto = await Producto.create({
      nombre,
      descripcion,
      foto,
      precio,
      costo,
      proveedorId,
      categoria,
      tipo: tipo || 'otros',
      localId: localId || req.user?.localId
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

    if (!Array.isArray(productos) || productos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un array de productos'
      });
    }

    const productosCreados = await Producto.bulkCreate(productos);

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

    const producto = await Producto.findByPk(id);

    if (!producto) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
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

    await producto.update({
      nombre: nombre || producto.nombre,
      descripcion: descripcion !== undefined ? descripcion : producto.descripcion,
      foto: foto !== undefined ? foto : producto.foto,
      precio: precio || producto.precio,
      costo: costo || producto.costo,
      proveedorId: proveedorId !== undefined ? proveedorId : producto.proveedorId,
      categoria: categoria !== undefined ? categoria : producto.categoria,
      activo: activo !== undefined ? activo : producto.activo,
      tipo: tipo !== undefined ? tipo : producto.tipo
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

    const producto = await Producto.findByPk(id);

    if (!producto) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
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

    const producto = await Producto.findByPk(id);

    if (!producto) {
      return res.status(404).json({
        success: false,
        message: 'Producto no encontrado'
      });
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
    
    if (localId) where.localId = localId;

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

    res.json({
      success: true,
      data: categorias.map(c => ({
        nombre: c.categoria,
        cantidad: parseInt(c.cantidad)
      }))
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

module.exports = {
  getAllProductos,
  getProductoById,
  createProducto,
  createMultipleProductos,
  updateProducto,
  updateProductoProveedor,
  deleteProducto,
  getCategorias,
  getProductosPorCategoria
};
