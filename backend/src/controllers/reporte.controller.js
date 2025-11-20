const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

// Reporte de ventas por período
const getVentasPorPeriodo = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    if (!fechaInicio || !fechaFin) {
      return res.status(400).json({
        success: false,
        message: 'Debe proporcionar fechaInicio y fechaFin'
      });
    }

    const ventas = await sequelize.query(
      `SELECT * FROM v_ventas_diarias 
       WHERE fecha BETWEEN :fechaInicio AND :fechaFin 
       ORDER BY fecha DESC`,
      {
        replacements: { fechaInicio, fechaFin },
        type: QueryTypes.SELECT
      }
    );

    const totalVentas = ventas.reduce((sum, v) => sum + parseFloat(v.total_ventas || 0), 0);
    const totalComandas = ventas.reduce((sum, v) => sum + parseInt(v.total_comandas || 0), 0);
    const totalPedidos = ventas.reduce((sum, v) => sum + parseInt(v.total_pedidos || 0), 0);

    res.json({
      success: true,
      data: {
        ventas,
        resumen: {
          totalVentas: totalVentas.toFixed(2),
          totalComandas,
          totalPedidos,
          ticketPromedio: totalComandas > 0 ? (totalVentas / totalComandas).toFixed(2) : 0,
          dias: ventas.length
        }
      }
    });
  } catch (error) {
    console.error('Error en getVentasPorPeriodo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ventas',
      error: error.message
    });
  }
};

// Reporte de productos más vendidos
const getProductosMasVendidos = async (req, res) => {
  try {
    const { fechaInicio, fechaFin, limit = 20 } = req.query;

    let query = `SELECT * FROM v_productos_mas_vendidos`;
    const replacements = {};

    if (fechaInicio && fechaFin) {
      query += ` WHERE fecha_ultimo_pedido BETWEEN :fechaInicio AND :fechaFin`;
      replacements.fechaInicio = fechaInicio;
      replacements.fechaFin = fechaFin;
    }

    query += ` ORDER BY total_vendido DESC LIMIT :limit`;
    replacements.limit = parseInt(limit);

    const productos = await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT
    });

    const totalIngresos = productos.reduce((sum, p) => sum + parseFloat(p.ingresos_generados || 0), 0);
    const totalUnidades = productos.reduce((sum, p) => sum + parseInt(p.total_vendido || 0), 0);

    res.json({
      success: true,
      data: {
        productos,
        resumen: {
          totalIngresos: totalIngresos.toFixed(2),
          totalUnidades,
          productosListados: productos.length
        }
      }
    });
  } catch (error) {
    console.error('Error en getProductosMasVendidos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener productos más vendidos',
      error: error.message
    });
  }
};

// Reporte de ventas por producto
const getVentasPorProducto = async (req, res) => {
  try {
    const { fechaInicio, fechaFin, categoria } = req.query;

    let query = `SELECT * FROM v_ventas_por_producto WHERE 1=1`;
    const replacements = {};

    if (fechaInicio && fechaFin) {
      query += ` AND fecha_ultimo_pedido BETWEEN :fechaInicio AND :fechaFin`;
      replacements.fechaInicio = fechaInicio;
      replacements.fechaFin = fechaFin;
    }

    if (categoria) {
      query += ` AND categoria = :categoria`;
      replacements.categoria = categoria;
    }

    query += ` ORDER BY total_ingresos DESC`;

    const ventas = await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT
    });

    const totalIngresos = ventas.reduce((sum, v) => sum + parseFloat(v.total_ingresos || 0), 0);
    const totalUnidades = ventas.reduce((sum, v) => sum + parseInt(v.total_vendido || 0), 0);

    res.json({
      success: true,
      data: {
        ventas,
        resumen: {
          totalIngresos: totalIngresos.toFixed(2),
          totalUnidades,
          productos: ventas.length,
          precioPromedioVenta: totalUnidades > 0 ? (totalIngresos / totalUnidades).toFixed(2) : 0
        }
      }
    });
  } catch (error) {
    console.error('Error en getVentasPorProducto:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ventas por producto',
      error: error.message
    });
  }
};

// Reporte de ventas por mesa
const getVentasPorMesa = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    let query = `SELECT * FROM v_ventas_por_mesa WHERE 1=1`;
    const replacements = {};

    if (fechaInicio && fechaFin) {
      query += ` AND ultima_comanda BETWEEN :fechaInicio AND :fechaFin`;
      replacements.fechaInicio = fechaInicio;
      replacements.fechaFin = fechaFin;
    }

    query += ` ORDER BY total_vendido DESC`;

    const ventas = await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT
    });

    const totalIngresos = ventas.reduce((sum, v) => sum + parseFloat(v.total_vendido || 0), 0);
    const totalComandas = ventas.reduce((sum, v) => sum + parseInt(v.total_comandas || 0), 0);

    res.json({
      success: true,
      data: {
        ventas,
        resumen: {
          totalIngresos: totalIngresos.toFixed(2),
          totalComandas,
          mesas: ventas.length,
          promedioMesa: ventas.length > 0 ? (totalIngresos / ventas.length).toFixed(2) : 0
        }
      }
    });
  } catch (error) {
    console.error('Error en getVentasPorMesa:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener ventas por mesa',
      error: error.message
    });
  }
};

// Reporte de pagos pendientes a proveedores
const getPagosPendientesProveedores = async (req, res) => {
  try {
    const pagos = await sequelize.query(
      `SELECT * FROM v_pagos_pendientes_proveedores ORDER BY monto_pendiente DESC`,
      { type: QueryTypes.SELECT }
    );

    const totalPendiente = pagos.reduce((sum, p) => sum + parseFloat(p.monto_pendiente || 0), 0);

    res.json({
      success: true,
      data: {
        pagos,
        resumen: {
          totalPendiente: totalPendiente.toFixed(2),
          proveedoresConDeuda: pagos.length
        }
      }
    });
  } catch (error) {
    console.error('Error en getPagosPendientesProveedores:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener pagos pendientes',
      error: error.message
    });
  }
};

// Reporte de rendimiento de meseros
const getRendimientoMeseros = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    let query = `SELECT * FROM v_rendimiento_meseros WHERE 1=1`;
    const replacements = {};

    if (fechaInicio && fechaFin) {
      query += ` AND ultima_comanda BETWEEN :fechaInicio AND :fechaFin`;
      replacements.fechaInicio = fechaInicio;
      replacements.fechaFin = fechaFin;
    }

    query += ` ORDER BY total_vendido DESC`;

    const rendimiento = await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT
    });

    const totalVentas = rendimiento.reduce((sum, r) => sum + parseFloat(r.total_vendido || 0), 0);
    const totalComandas = rendimiento.reduce((sum, r) => sum + parseInt(r.total_comandas || 0), 0);

    res.json({
      success: true,
      data: {
        rendimiento,
        resumen: {
          totalVentas: totalVentas.toFixed(2),
          totalComandas,
          meseros: rendimiento.length,
          ventaPromedioPorMesero: rendimiento.length > 0 ? (totalVentas / rendimiento.length).toFixed(2) : 0,
          comandasPromedioPorMesero: rendimiento.length > 0 ? Math.round(totalComandas / rendimiento.length) : 0
        }
      }
    });
  } catch (error) {
    console.error('Error en getRendimientoMeseros:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener rendimiento de meseros',
      error: error.message
    });
  }
};

// Estado de comandas
const getEstadoComandas = async (req, res) => {
  try {
    const estado = await sequelize.query(
      `SELECT * FROM v_estado_comandas ORDER BY mesa_numero`,
      { type: QueryTypes.SELECT }
    );

    const resumen = {
      comandasAbiertas: estado.length,
      totalPendiente: estado.reduce((sum, c) => sum + parseFloat(c.total_comanda || 0), 0).toFixed(2),
      pedidosTotales: estado.reduce((sum, c) => sum + parseInt(c.total_pedidos || 0), 0),
      pedidosListos: estado.reduce((sum, c) => sum + parseInt(c.pedidos_listos || 0), 0),
      pedidosPendientes: estado.reduce((sum, c) => sum + parseInt(c.pedidos_pendientes || 0), 0),
      pedidosPreparando: estado.reduce((sum, c) => sum + parseInt(c.pedidos_preparando || 0), 0)
    };

    res.json({
      success: true,
      data: {
        comandas: estado,
        resumen
      }
    });
  } catch (error) {
    console.error('Error en getEstadoComandas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estado de comandas',
      error: error.message
    });
  }
};

// Inventario de proveedores
const getInventarioProveedores = async (req, res) => {
  try {
    const { proveedorId } = req.query;

    let query = `SELECT * FROM v_inventario_proveedores`;
    const replacements = {};

    if (proveedorId) {
      query += ` WHERE proveedor_id = :proveedorId`;
      replacements.proveedorId = proveedorId;
    }

    query += ` ORDER BY proveedor_nombre, producto_nombre`;

    const inventario = await sequelize.query(query, {
      replacements,
      type: QueryTypes.SELECT
    });

    const totalProductos = inventario.length;
    const proveedoresUnicos = [...new Set(inventario.map(i => i.proveedor_id))].length;

    res.json({
      success: true,
      data: {
        inventario,
        resumen: {
          totalProductos,
          proveedores: proveedoresUnicos
        }
      }
    });
  } catch (error) {
    console.error('Error en getInventarioProveedores:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener inventario',
      error: error.message
    });
  }
};

// Dashboard general (resumen de todo)
const getDashboardResumen = async (req, res) => {
  try {
    const hoy = new Date().toISOString().split('T')[0];

    // Ventas del día
    const ventasHoy = await sequelize.query(
      `SELECT * FROM v_ventas_diarias WHERE fecha = :hoy`,
      {
        replacements: { hoy },
        type: QueryTypes.SELECT
      }
    );

    // Comandas abiertas
    const comandasAbiertas = await sequelize.query(
      `SELECT COUNT(*) as total FROM v_estado_comandas`,
      { type: QueryTypes.SELECT }
    );

    // Top 5 productos del mes
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const topProductos = await sequelize.query(
      `SELECT * FROM v_productos_mas_vendidos 
       WHERE fecha_ultimo_pedido >= :inicioMes 
       ORDER BY total_vendido DESC LIMIT 5`,
      {
        replacements: { inicioMes },
        type: QueryTypes.SELECT
      }
    );

    // Pagos pendientes
    const pagosPendientes = await sequelize.query(
      `SELECT SUM(monto_pendiente) as total FROM v_pagos_pendientes_proveedores`,
      { type: QueryTypes.SELECT }
    );

    res.json({
      success: true,
      data: {
        ventasHoy: ventasHoy[0] || { total_ventas: 0, total_comandas: 0, total_pedidos: 0 },
        comandasAbiertas: comandasAbiertas[0]?.total || 0,
        topProductos,
        pagosPendientes: parseFloat(pagosPendientes[0]?.total || 0).toFixed(2)
      }
    });
  } catch (error) {
    console.error('Error en getDashboardResumen:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener resumen del dashboard',
      error: error.message
    });
  }
};

// Reporte por período (mensual, trimestral, semestral, anual)
const getReportePorPeriodo = async (req, res) => {
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

    // Ventas totales
    const ventas = await sequelize.query(
      `SELECT 
        DATE(c.cerrada_at) as fecha,
        COUNT(DISTINCT c.id) as total_comandas,
        COUNT(p.id) as total_pedidos,
        SUM(c.total) as total_ventas,
        AVG(c.total) as ticket_promedio
      FROM comandas c
      LEFT JOIN pedidos p ON c.id = p.comanda_id
      WHERE c.local_id = :localId
        AND c.estado = 'cerrada'
        AND c.cerrada_at BETWEEN :fechaDesde AND :fechaHasta
      GROUP BY DATE(c.cerrada_at)
      ORDER BY fecha ASC`,
      {
        replacements: { 
          localId, 
          fechaDesde: fechaDesde.toISOString(), 
          fechaHasta: fechaHasta.toISOString() 
        },
        type: QueryTypes.SELECT
      }
    );

    // Productos más vendidos
    const productosMasVendidos = await sequelize.query(
      `SELECT 
        pr.id,
        pr.nombre,
        pr.categoria,
        pr.tipo,
        SUM(p.cantidad) as total_vendido,
        SUM(p.subtotal) as ingresos_generados,
        SUM(p.cantidad * pr.costo) as costo_total,
        SUM(p.subtotal) - SUM(p.cantidad * pr.costo) as margen_bruto,
        ((SUM(p.subtotal) - SUM(p.cantidad * pr.costo)) / NULLIF(SUM(p.subtotal), 0) * 100) as margen_porcentaje
      FROM pedidos p
      INNER JOIN comandas c ON p.comanda_id = c.id
      INNER JOIN productos pr ON p.producto_id = pr.id
      WHERE c.local_id = :localId
        AND c.estado = 'cerrada'
        AND c.cerrada_at BETWEEN :fechaDesde AND :fechaHasta
      GROUP BY pr.id, pr.nombre, pr.categoria, pr.tipo
      ORDER BY total_vendido DESC
      LIMIT 10`,
      {
        replacements: { 
          localId, 
          fechaDesde: fechaDesde.toISOString(), 
          fechaHasta: fechaHasta.toISOString() 
        },
        type: QueryTypes.SELECT
      }
    );

    // Productos menos vendidos
    const productosMenosVendidos = await sequelize.query(
      `SELECT 
        pr.id,
        pr.nombre,
        pr.categoria,
        pr.tipo,
        SUM(p.cantidad) as total_vendido,
        SUM(p.subtotal) as ingresos_generados
      FROM pedidos p
      INNER JOIN comandas c ON p.comanda_id = c.id
      INNER JOIN productos pr ON p.producto_id = pr.id
      WHERE c.local_id = :localId
        AND c.estado = 'cerrada'
        AND c.cerrada_at BETWEEN :fechaDesde AND :fechaHasta
      GROUP BY pr.id, pr.nombre, pr.categoria, pr.tipo
      ORDER BY total_vendido ASC
      LIMIT 10`,
      {
        replacements: { 
          localId, 
          fechaDesde: fechaDesde.toISOString(), 
          fechaHasta: fechaHasta.toISOString() 
        },
        type: QueryTypes.SELECT
      }
    );

    // Análisis por categoría
    const ventasPorCategoria = await sequelize.query(
      `SELECT 
        pr.categoria,
        COUNT(DISTINCT pr.id) as productos_diferentes,
        SUM(p.cantidad) as total_vendido,
        SUM(p.subtotal) as ingresos_generados,
        SUM(p.cantidad * pr.costo) as costo_total,
        SUM(p.subtotal) - SUM(p.cantidad * pr.costo) as margen_bruto
      FROM pedidos p
      INNER JOIN comandas c ON p.comanda_id = c.id
      INNER JOIN productos pr ON p.producto_id = pr.id
      WHERE c.local_id = :localId
        AND c.estado = 'cerrada'
        AND c.cerrada_at BETWEEN :fechaDesde AND :fechaHasta
      GROUP BY pr.categoria
      ORDER BY ingresos_generados DESC`,
      {
        replacements: { 
          localId, 
          fechaDesde: fechaDesde.toISOString(), 
          fechaHasta: fechaHasta.toISOString() 
        },
        type: QueryTypes.SELECT
      }
    );

    // Análisis por tipo (comida vs bebida)
    const ventasPorTipo = await sequelize.query(
      `SELECT 
        pr.tipo,
        COUNT(DISTINCT pr.id) as productos_diferentes,
        SUM(p.cantidad) as total_vendido,
        SUM(p.subtotal) as ingresos_generados,
        SUM(p.cantidad * pr.costo) as costo_total,
        SUM(p.subtotal) - SUM(p.cantidad * pr.costo) as margen_bruto
      FROM pedidos p
      INNER JOIN comandas c ON p.comanda_id = c.id
      INNER JOIN productos pr ON p.producto_id = pr.id
      WHERE c.local_id = :localId
        AND c.estado = 'cerrada'
        AND c.cerrada_at BETWEEN :fechaDesde AND :fechaHasta
      GROUP BY pr.tipo
      ORDER BY ingresos_generados DESC`,
      {
        replacements: { 
          localId, 
          fechaDesde: fechaDesde.toISOString(), 
          fechaHasta: fechaHasta.toISOString() 
        },
        type: QueryTypes.SELECT
      }
    );

    // Calcular totales
    const totalVentas = ventas.reduce((sum, v) => sum + parseFloat(v.total_ventas || 0), 0);
    const totalComandas = ventas.reduce((sum, v) => sum + parseInt(v.total_comandas || 0), 0);
    const totalMargen = productosMasVendidos.reduce((sum, p) => sum + parseFloat(p.margen_bruto || 0), 0);

    res.json({
      success: true,
      data: {
        periodo,
        fechaDesde: fechaDesde.toISOString().split('T')[0],
        fechaHasta: fechaHasta.toISOString().split('T')[0],
        resumen: {
          totalVentas: parseFloat(totalVentas.toFixed(2)),
          totalComandas,
          ticketPromedio: totalComandas > 0 ? parseFloat((totalVentas / totalComandas).toFixed(2)) : 0,
          totalMargen: parseFloat(totalMargen.toFixed(2)),
          margenPorcentaje: totalVentas > 0 ? parseFloat(((totalMargen / totalVentas) * 100).toFixed(2)) : 0
        },
        ventasPorDia: ventas.map(v => ({
          fecha: v.fecha,
          totalComandas: parseInt(v.total_comandas),
          totalPedidos: parseInt(v.total_pedidos),
          totalVentas: parseFloat(v.total_ventas),
          ticketPromedio: parseFloat(v.ticket_promedio)
        })),
        productosMasVendidos: productosMasVendidos.map(p => ({
          id: p.id,
          nombre: p.nombre,
          categoria: p.categoria,
          tipo: p.tipo,
          totalVendido: parseInt(p.total_vendido),
          ingresosGenerados: parseFloat(p.ingresos_generados),
          costoTotal: parseFloat(p.costo_total),
          margenBruto: parseFloat(p.margen_bruto),
          margenPorcentaje: parseFloat(p.margen_porcentaje)
        })),
        productosMenosVendidos: productosMenosVendidos.map(p => ({
          id: p.id,
          nombre: p.nombre,
          categoria: p.categoria,
          tipo: p.tipo,
          totalVendido: parseInt(p.total_vendido),
          ingresosGenerados: parseFloat(p.ingresos_generados)
        })),
        ventasPorCategoria: ventasPorCategoria.map(c => ({
          categoria: c.categoria,
          productosDiferentes: parseInt(c.productos_diferentes),
          totalVendido: parseInt(c.total_vendido),
          ingresosGenerados: parseFloat(c.ingresos_generados),
          costoTotal: parseFloat(c.costo_total),
          margenBruto: parseFloat(c.margen_bruto)
        })),
        ventasPorTipo: ventasPorTipo.map(t => ({
          tipo: t.tipo,
          productosDiferentes: parseInt(t.productos_diferentes),
          totalVendido: parseInt(t.total_vendido),
          ingresosGenerados: parseFloat(t.ingresos_generados),
          costoTotal: parseFloat(t.costo_total),
          margenBruto: parseFloat(t.margen_bruto)
        }))
      }
    });
  } catch (error) {
    console.error('Error en getReportePorPeriodo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al generar reporte por período',
      error: error.message
    });
  }
};

module.exports = {
  getVentasPorPeriodo,
  getProductosMasVendidos,
  getVentasPorProducto,
  getVentasPorMesa,
  getPagosPendientesProveedores,
  getRendimientoMeseros,
  getEstadoComandas,
  getInventarioProveedores,
  getDashboardResumen,
  getReportePorPeriodo
};
