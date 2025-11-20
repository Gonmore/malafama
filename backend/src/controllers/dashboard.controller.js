const { Comanda, Pedido, Producto, Mesa } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

// Obtener métricas del dashboard
const getDashboardMetrics = async (req, res) => {
  try {
    const { localId } = req.query;

    if (!localId) {
      return res.status(400).json({
        success: false,
        message: 'localId es requerido'
      });
    }

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    // Pedidos activos (comandas abiertas)
    const pedidosActivos = await Comanda.count({
      where: {
        localId,
        estado: 'abierta'
      }
    });

    // Ventas del día
    const ventasHoy = await Comanda.sum('total', {
      where: {
        localId,
        estado: 'cerrada',
        cerradaAt: {
          [Op.gte]: hoy
        }
      }
    }) || 0;

    // Productos más vendidos (últimos 30 días)
    const hace30Dias = new Date();
    hace30Dias.setDate(hace30Dias.getDate() - 30);

    const productosMasVendidos = await Pedido.findAll({
      attributes: [
        'productoId',
        [sequelize.fn('SUM', sequelize.col('cantidad')), 'totalVendido'],
        [sequelize.fn('SUM', sequelize.col('subtotal')), 'totalIngresos']
      ],
      include: [
        {
          model: Comanda,
          as: 'comanda',
          where: {
            localId,
            estado: 'cerrada',
            cerradaAt: {
              [Op.gte]: hace30Dias
            }
          },
          attributes: []
        },
        {
          model: Producto,
          as: 'producto',
          attributes: ['id', 'nombre', 'precio', 'categoria', 'tipo']
        }
      ],
      group: ['Pedido.producto_id', 'producto.id'],
      order: [[sequelize.fn('SUM', sequelize.col('cantidad')), 'DESC']],
      limit: 5,
      raw: false
    });

    // Ventas últimos 7 días
    const ventasUltimos7Dias = [];
    for (let i = 6; i >= 0; i--) {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - i);
      fecha.setHours(0, 0, 0, 0);
      
      const fechaSiguiente = new Date(fecha);
      fechaSiguiente.setDate(fechaSiguiente.getDate() + 1);

      const ventasDia = await Comanda.sum('total', {
        where: {
          localId,
          estado: 'cerrada',
          cerradaAt: {
            [Op.gte]: fecha,
            [Op.lt]: fechaSiguiente
          }
        }
      }) || 0;

      ventasUltimos7Dias.push({
        fecha: fecha.toISOString().split('T')[0],
        total: parseFloat(ventasDia)
      });
    }

    // Mesas ocupadas (mesas con comandas abiertas)
    const mesasOcupadas = await Mesa.count({
      where: {
        localId
      },
      include: [{
        model: Comanda,
        as: 'comandas',
        where: {
          estado: 'abierta'
        },
        required: true,
        attributes: []
      }]
    });

    res.json({
      success: true,
      data: {
        pedidosActivos,
        ventasHoy: parseFloat(ventasHoy),
        mesasOcupadas,
        productosMasVendidos: productosMasVendidos.map(p => ({
          id: p.producto.id,
          nombre: p.producto.nombre,
          categoria: p.producto.categoria,
          tipo: p.producto.tipo,
          totalVendido: parseInt(p.dataValues.totalVendido),
          totalIngresos: parseFloat(p.dataValues.totalIngresos)
        })),
        ventasUltimos7Dias
      }
    });
  } catch (error) {
    console.error('Error en getDashboardMetrics:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener métricas del dashboard',
      error: error.message
    });
  }
};

// Obtener resumen de ventas por período
const getVentasPorPeriodo = async (req, res) => {
  try {
    const { localId, periodo, fechaInicio, fechaFin } = req.query;

    if (!localId) {
      return res.status(400).json({
        success: false,
        message: 'localId es requerido'
      });
    }

    let fechaDesde = new Date();
    const fechaHasta = fechaFin ? new Date(fechaFin) : new Date();

    // Calcular fecha desde según el período
    switch (periodo) {
      case 'mensual':
        fechaDesde.setMonth(fechaDesde.getMonth() - 1);
        break;
      case 'trimestral':
        fechaDesde.setMonth(fechaDesde.getMonth() - 3);
        break;
      case 'semestral':
        fechaDesde.setMonth(fechaDesde.getMonth() - 6);
        break;
      case 'anual':
        fechaDesde.setFullYear(fechaDesde.getFullYear() - 1);
        break;
      default:
        if (fechaInicio) {
          fechaDesde = new Date(fechaInicio);
        }
    }

    const ventas = await Comanda.findAll({
      where: {
        localId,
        estado: 'cerrada',
        cerradaAt: {
          [Op.gte]: fechaDesde,
          [Op.lte]: fechaHasta
        }
      },
      attributes: [
        [sequelize.fn('DATE', sequelize.col('cerrada_at')), 'fecha'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'cantidad'],
        [sequelize.fn('SUM', sequelize.col('total')), 'total']
      ],
      group: [sequelize.fn('DATE', sequelize.col('cerrada_at'))],
      order: [[sequelize.fn('DATE', sequelize.col('cerrada_at')), 'ASC']],
      raw: true
    });

    const totalVentas = ventas.reduce((sum, v) => sum + parseFloat(v.total || 0), 0);
    const totalComandas = ventas.reduce((sum, v) => sum + parseInt(v.cantidad || 0), 0);

    res.json({
      success: true,
      data: {
        periodo,
        fechaDesde: fechaDesde.toISOString().split('T')[0],
        fechaHasta: fechaHasta.toISOString().split('T')[0],
        totalVentas: parseFloat(totalVentas),
        totalComandas,
        promedioTicket: totalComandas > 0 ? parseFloat(totalVentas / totalComandas) : 0,
        ventasPorDia: ventas.map(v => ({
          fecha: v.fecha,
          cantidad: parseInt(v.cantidad),
          total: parseFloat(v.total)
        }))
      }
    });
  } catch (error) {
    console.error('Error en getVentasPorPeriodo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ventas por período',
      error: error.message
    });
  }
};

module.exports = {
  getDashboardMetrics,
  getVentasPorPeriodo
};
