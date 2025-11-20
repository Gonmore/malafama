const { Mesa, Comanda } = require('../models');
const { MesaAsignada, Usuario } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

// Listar todas las mesas
const getAllMesas = async (req, res) => {
  try {
    const { activo, disponible } = req.query;
    
    const where = {};
    if (activo !== undefined) where.activo = activo === 'true';

    const mesas = await Mesa.findAll({
      where,
      include: [{
        model: Comanda,
        as: 'comandas',
        where: { estado: 'abierta' },
        required: false,
        include: ['pedidos']
      }],
      order: [['numero', 'ASC']]
    });

    // Calcular disponibilidad
    const mesasConDisponibilidad = mesas.map(mesa => {
      const mesaJson = mesa.toJSON();
      const tieneComandaAbierta = mesaJson.comandas && mesaJson.comandas.length > 0;
      
      return {
        ...mesaJson,
        disponible: !tieneComandaAbierta,
        comandaActual: tieneComandaAbierta ? mesaJson.comandas[0].id : null
      };
    });

    // Filtrar por disponibilidad si se solicita
    const resultado = disponible !== undefined
      ? mesasConDisponibilidad.filter(m => m.disponible === (disponible === 'true'))
      : mesasConDisponibilidad;

    res.json({
      success: true,
      data: resultado
    });
  } catch (error) {
    console.error('Error en getAllMesas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener mesas',
      error: error.message
    });
  }
};

// Obtener mesa por ID
const getMesaById = async (req, res) => {
  try {
    const { id } = req.params;

    const mesa = await Mesa.findByPk(id, {
      include: [{
        model: Comanda,
        as: 'comandas',
        where: { estado: 'abierta' },
        required: false,
        include: ['pedidos']
      }]
    });

    if (!mesa) {
      return res.status(404).json({
        success: false,
        message: 'Mesa no encontrada'
      });
    }

    const mesaJson = mesa.toJSON();
    const tieneComandaAbierta = mesaJson.comandas && mesaJson.comandas.length > 0;

    res.json({
      success: true,
      data: {
        ...mesaJson,
        disponible: !tieneComandaAbierta,
        comandaActual: tieneComandaAbierta ? mesaJson.comandas[0] : null
      }
    });
  } catch (error) {
    console.error('Error en getMesaById:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener mesa',
      error: error.message
    });
  }
};

// Crear mesa
const createMesa = async (req, res) => {
  try {
    const { nombre, numero, ubicacion, capacidad } = req.body;

    // Verificar que el número no esté en uso
    const mesaExistente = await Mesa.findOne({ where: { numero } });
    if (mesaExistente) {
      return res.status(400).json({
        success: false,
        message: `Ya existe una mesa con el número ${numero}`
      });
    }

    const mesa = await Mesa.create({
      nombre,
      numero,
      ubicacion,
      capacidad: capacidad || 4
    });

    res.status(201).json({
      success: true,
      message: 'Mesa creada exitosamente',
      data: mesa
    });
  } catch (error) {
    console.error('Error en createMesa:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear mesa',
      error: error.message
    });
  }
};

// Crear múltiples mesas
const createMultipleMesas = async (req, res) => {
  try {
    const { cantidad, ubicacion, capacidad } = req.body;

    if (!cantidad || cantidad < 1 || cantidad > 100) {
      return res.status(400).json({
        success: false,
        message: 'La cantidad debe estar entre 1 y 100'
      });
    }

    // Obtener el último número de mesa
    const ultimaMesa = await Mesa.findOne({
      order: [['numero', 'DESC']]
    });

    const numeroInicial = ultimaMesa ? ultimaMesa.numero + 1 : 1;
    const mesas = [];

    for (let i = 0; i < cantidad; i++) {
      const numero = numeroInicial + i;
      mesas.push({
        nombre: `Mesa ${numero}`,
        numero,
        ubicacion: ubicacion || null,
        capacidad: capacidad || 4
      });
    }

    const mesasCreadas = await Mesa.bulkCreate(mesas);

    res.status(201).json({
      success: true,
      message: `${mesasCreadas.length} mesas creadas exitosamente`,
      data: mesasCreadas
    });
  } catch (error) {
    console.error('Error en createMultipleMesas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear mesas',
      error: error.message
    });
  }
};

// Actualizar mesa
const updateMesa = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, numero, ubicacion, capacidad, activo } = req.body;

    const mesa = await Mesa.findByPk(id);

    if (!mesa) {
      return res.status(404).json({
        success: false,
        message: 'Mesa no encontrada'
      });
    }

    // Si se está actualizando el número, verificar que no exista
    if (numero && numero !== mesa.numero) {
      const mesaExistente = await Mesa.findOne({ where: { numero } });
      if (mesaExistente) {
        return res.status(400).json({
          success: false,
          message: `Ya existe una mesa con el número ${numero}`
        });
      }
    }

    await mesa.update({
      nombre: nombre || mesa.nombre,
      numero: numero || mesa.numero,
      ubicacion: ubicacion !== undefined ? ubicacion : mesa.ubicacion,
      capacidad: capacidad || mesa.capacidad,
      activo: activo !== undefined ? activo : mesa.activo
    });

    res.json({
      success: true,
      message: 'Mesa actualizada exitosamente',
      data: mesa
    });
  } catch (error) {
    console.error('Error en updateMesa:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar mesa',
      error: error.message
    });
  }
};

// Eliminar mesa (soft delete)
const deleteMesa = async (req, res) => {
  try {
    const { id } = req.params;

    const mesa = await Mesa.findByPk(id);

    if (!mesa) {
      return res.status(404).json({
        success: false,
        message: 'Mesa no encontrada'
      });
    }

    // Verificar que no tenga comandas abiertas
    const comandasAbiertas = await Comanda.count({
      where: {
        mesaId: id,
        estado: 'abierta'
      }
    });

    if (comandasAbiertas > 0) {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar una mesa con comandas abiertas'
      });
    }

    await mesa.update({ activo: false });

    res.json({
      success: true,
      message: 'Mesa desactivada exitosamente'
    });
  } catch (error) {
    console.error('Error en deleteMesa:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar mesa',
      error: error.message
    });
  }
};

// Obtener estado de ocupación de mesas
const getEstadoOcupacion = async (req, res) => {
  try {
    const totalMesas = await Mesa.count({ where: { activo: true } });
    
    const mesasOcupadas = await Mesa.count({
      where: { activo: true },
      include: [{
        model: Comanda,
        as: 'comandas',
        where: { estado: 'abierta' },
        required: true
      }]
    });

    const mesasDisponibles = totalMesas - mesasOcupadas;
    const porcentajeOcupacion = totalMesas > 0 
      ? Math.round((mesasOcupadas / totalMesas) * 100)
      : 0;

    res.json({
      success: true,
      data: {
        totalMesas,
        mesasOcupadas,
        mesasDisponibles,
        porcentajeOcupacion
      }
    });
  } catch (error) {
    console.error('Error en getEstadoOcupacion:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estado de ocupación',
      error: error.message
    });
  }
};

// Obtener mesas asignadas al usuario autenticado (mesero)
const getMesasAsignadas = async (req, res) => {
  try {
    const usuarioId = req.user.id;

    const asignaciones = await MesaAsignada.findAll({
      where: { usuarioId }
    });

    const mesaIds = asignaciones.map(a => a.mesaId);

    const mesas = await Mesa.findAll({
      where: { id: mesaIds },
      order: [['numero', 'ASC']]
    });

    res.json({ success: true, data: mesas });
  } catch (error) {
    console.error('Error en getMesasAsignadas:', error);
    res.status(500).json({ success: false, message: 'Error al obtener mesas asignadas', error: error.message });
  }
};

// Asignar mesas a un usuario
const assignMesas = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { mesaIds, usuarioId } = req.body;

    // Default: asignacion del usuario actual si no se envia usuarioId
    const targetUserId = usuarioId || req.user.id;

    // Validar que el usuario existe y pertenezca al mismo local si no es admin
    const usuario = await Usuario.findByPk(targetUserId);
    if (!usuario) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    // Validar que las mesas existan y pertenezcan al mismo local (si no es admin)
    const mesasObjs = await Mesa.findAll({ where: { id: mesaIds } });
    if (mesasObjs.length !== mesaIds.length) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Algunas mesas no existen' });
    }
    if (req.user.tipo !== 'admin') {
      const notInLocal = mesasObjs.some(m => m.localId !== req.user.localId);
      if (notInLocal) {
        await t.rollback();
        return res.status(403).json({ success: false, message: 'No puedes asignar mesas fuera de tu local' });
      }
    }

    // Eliminar las asignaciones previas
    await MesaAsignada.destroy({ where: { usuarioId: targetUserId }, transaction: t });

    // Insertar nuevas asignaciones
    const nuevas = mesaIds.map(mesaId => ({ usuarioId: targetUserId, mesaId }));
    await MesaAsignada.bulkCreate(nuevas, { transaction: t });

    await t.commit();

    res.json({ success: true, message: 'Mesas asignadas correctamente' });
  } catch (error) {
    await t.rollback();
    console.error('Error en assignMesas:', error);
    res.status(500).json({ success: false, message: 'Error al asignar mesas', error: error.message });
  }
};

module.exports = {
  getAllMesas,
  getMesaById,
  createMesa,
  createMultipleMesas,
  updateMesa,
  deleteMesa,
  getEstadoOcupacion
  ,getMesasAsignadas, assignMesas
};
