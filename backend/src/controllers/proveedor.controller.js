const { Proveedor, Usuario, Producto } = require('../models');

// Listar todos los proveedores
const getAllProveedores = async (req, res) => {
  try {
    // Filtrar por localId: prefer query param ?localId, luego usuario.localId
    const whereClause = {};
    const qLocal = req.query.localId || (req.user && req.user.localId);
    if (qLocal) whereClause.localId = qLocal;

    const proveedores = await Proveedor.findAll({
      where: whereClause,
      include: [{
        model: Usuario,
        as: 'usuario',
        attributes: ['id', 'nombre', 'email']
      }],
      order: [['nombre', 'ASC']]
    });

    res.json({
      success: true,
      data: proveedores
    });
  } catch (error) {
    console.error('Error en getAllProveedores:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener proveedores',
      error: error.message
    });
  }
};

// Obtener proveedor por ID
const getProveedorById = async (req, res) => {
  try {
    const { id } = req.params;

    const proveedor = await Proveedor.findByPk(id, {
      include: [
        {
          model: Usuario,
          as: 'usuario',
          attributes: ['id', 'nombre', 'email']
        },
        {
          model: Producto,
          as: 'productos',
          where: { activo: true },
          required: false
        }
      ]
    });

    if (!proveedor) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    res.json({
      success: true,
      data: proveedor
    });
  } catch (error) {
    console.error('Error en getProveedorById:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener proveedor',
      error: error.message
    });
  }
};

// Crear proveedor
const createProveedor = async (req, res) => {
  try {
    const { nombre, contacto, telefono, email, esPropio, usuarioId, localId } = req.body;

    // Si se proporciona usuarioId, verificar que existe y es tipo proveedor
    if (usuarioId) {
      const usuario = await Usuario.findByPk(usuarioId);
      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
      if (usuario.tipo !== 'proveedor') {
        return res.status(400).json({
          success: false,
          message: 'El usuario debe ser de tipo proveedor'
        });
      }
    }

    // Asignar localId: primero del body, luego del usuario autenticado
    const proveedorLocalId = localId || req.user?.localId || null;

    const proveedor = await Proveedor.create({
      nombre,
      contacto,
      telefono,
      email,
      esPropio: esPropio || false,
      usuarioId,
      localId: proveedorLocalId
    });

    const proveedorCompleto = await Proveedor.findByPk(proveedor.id, {
      include: [{
        model: Usuario,
        as: 'usuario',
        attributes: ['id', 'nombre', 'email']
      }]
    });

    res.status(201).json({
      success: true,
      message: 'Proveedor creado exitosamente',
      data: {
        proveedor: proveedorCompleto
      }
    });
  } catch (error) {
    console.error('Error en createProveedor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear proveedor',
      error: error.message
    });
  }
};

// Actualizar proveedor
const updateProveedor = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, contacto, telefono, email, esPropio, usuarioId } = req.body;

    const proveedor = await Proveedor.findByPk(id);

    if (!proveedor) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    // Verificar usuario si se está actualizando
    if (usuarioId && usuarioId !== proveedor.usuarioId) {
      const usuario = await Usuario.findByPk(usuarioId);
      if (!usuario) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }
      if (usuario.tipo !== 'proveedor') {
        return res.status(400).json({
          success: false,
          message: 'El usuario debe ser de tipo proveedor'
        });
      }
    }

    await proveedor.update({
      nombre: nombre || proveedor.nombre,
      contacto: contacto !== undefined ? contacto : proveedor.contacto,
      telefono: telefono !== undefined ? telefono : proveedor.telefono,
      email: email !== undefined ? email : proveedor.email,
      esPropio: esPropio !== undefined ? esPropio : proveedor.esPropio,
      usuarioId: usuarioId !== undefined ? usuarioId : proveedor.usuarioId
    });

    const proveedorActualizado = await Proveedor.findByPk(id, {
      include: [{
        model: Usuario,
        as: 'usuario',
        attributes: ['id', 'nombre', 'email']
      }]
    });

    res.json({
      success: true,
      message: 'Proveedor actualizado exitosamente',
      data: proveedorActualizado
    });
  } catch (error) {
    console.error('Error en updateProveedor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar proveedor',
      error: error.message
    });
  }
};

// Eliminar proveedor
const deleteProveedor = async (req, res) => {
  try {
    const { id } = req.params;

    const proveedor = await Proveedor.findByPk(id);

    if (!proveedor) {
      return res.status(404).json({
        success: false,
        message: 'Proveedor no encontrado'
      });
    }

    // Verificar que no tenga productos asociados activos
    const productosActivos = await Producto.count({
      where: {
        proveedorId: id,
        activo: true
      }
    });

    if (productosActivos > 0) {
      return res.status(400).json({
        success: false,
        message: `No se puede eliminar el proveedor porque tiene ${productosActivos} productos activos asociados`
      });
    }

    await proveedor.destroy();

    res.json({
      success: true,
      message: 'Proveedor eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error en deleteProveedor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar proveedor',
      error: error.message
    });
  }
};

// Obtener proveedor "Propio"
const getProveedorPropio = async (req, res) => {
  try {
    const localId = req.query.localId || req.user?.localId || null;
    const whereClause = { esPropio: true };
    if (localId) whereClause.localId = localId;
    
    const proveedorPropio = await Proveedor.findOne({
      where: whereClause
    });

    if (!proveedorPropio) {
      // Crear si no existe
      const nuevo = await Proveedor.create({
        nombre: 'Propio',
        esPropio: true,
        contacto: 'Productos elaborados en el establecimiento',
        localId
      });

      return res.json({
        success: true,
        data: nuevo
      });
    }

    res.json({
      success: true,
      data: proveedorPropio
    });
  } catch (error) {
    console.error('Error en getProveedorPropio:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener proveedor propio',
      error: error.message
    });
  }
};

module.exports = {
  getAllProveedores,
  getProveedorById,
  createProveedor,
  updateProveedor,
  deleteProveedor,
  getProveedorPropio
};
