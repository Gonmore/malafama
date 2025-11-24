const { sequelize } = require('../config/database');
const { QueryTypes } = require('sequelize');
const { Comanda, Pedido, Producto, Mesa, Usuario, MesaAsignada, Local } = require('../models');
const { Op } = require('sequelize');

/**
 * Obtener reporte del día para el mesero
 * Un día va de 6 AM a 6 AM del día siguiente
 */
const getReporteDiaMesero = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Calcular inicio y fin del día (6 AM a 6 AM)
    const ahora = new Date();
    let inicioDia = new Date(ahora);
    inicioDia.setHours(6, 0, 0, 0);
    
    // Si aún no son las 6 AM, el día comenzó ayer a las 6 AM
    if (ahora.getHours() < 6) {
      inicioDia.setDate(inicioDia.getDate() - 1);
    }
    
    const finDia = new Date(inicioDia);
    finDia.setDate(finDia.getDate() + 1);
    
    // Obtener mesas asignadas al mesero a través de la tabla de asignaciones
    const asignaciones = await MesaAsignada.findAll({
      where: { usuarioId: userId }
    });
    
    const mesaIds = asignaciones.map(a => a.mesaId);
    
    if (mesaIds.length === 0) {
      return res.json({
        mensaje: 'No tienes mesas asignadas',
        inicioDia,
        finDia,
        mesas: [],
        totales: {
          totalDia: 0,
          totalEfectivo: 0,
          totalQr: 0,
          totalMixto: 0,
          comandasCerradas: 0,
          comandasAbiertas: 0
        }
      });
    }
    
    // Obtener todas las comandas del día de las mesas asignadas
    const comandas = await Comanda.findAll({
      where: {
        mesaId: { [Op.in]: mesaIds },
        createdAt: {
          [Op.gte]: inicioDia,
          [Op.lt]: finDia
        }
      },
      include: [
        {
          model: Mesa,
          as: 'mesa',
          attributes: ['id', 'numero']
        },
        {
          model: Pedido,
          as: 'pedidos',
          include: [
            {
              model: Producto,
              as: 'producto',
              attributes: ['id', 'nombre', 'precio']
            }
          ]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
    
    // Agrupar por mesa
    const mesasReporte = {};
    let totalDia = 0;
    let totalEfectivo = 0;
    let totalQr = 0;
    let totalMixto = 0;
    let comandasCerradas = 0;
    let comandasAbiertas = 0;
    
    comandas.forEach(comanda => {
      const mesaNumero = comanda.mesa.numero;
      
      if (!mesasReporte[mesaNumero]) {
        mesasReporte[mesaNumero] = {
          numero: mesaNumero,
          comandas: [],
          totalMesa: 0
        };
      }
      
      const comandaData = {
        id: comanda.id,
        estado: comanda.estado,
        total: parseFloat(comanda.total || 0),
        formaPago: comanda.formaPago,
        cantidadEfectivo: parseFloat(comanda.cantidadEfectivo || 0),
        cantidadQr: parseFloat(comanda.cantidadQr || 0),
        comprobante: comanda.comprobante, // URL o base64
        createdAt: comanda.createdAt,
        pedidos: comanda.pedidos.map(p => ({
          id: p.id,
          cantidad: p.cantidad,
          precioUnitario: parseFloat(p.precioUnitario),
          subtotal: parseFloat(p.subtotal),
          estado: p.estado,
          producto: p.producto ? {
            nombre: p.producto.nombre,
            precio: parseFloat(p.producto.precio)
          } : null
        }))
      };
      
      mesasReporte[mesaNumero].comandas.push(comandaData);
      
      if (comanda.estado === 'cerrada') {
        const total = parseFloat(comanda.total || 0);
        mesasReporte[mesaNumero].totalMesa += total;
        totalDia += total;
        comandasCerradas++;
        
        // Sumar por forma de pago
        if (comanda.formaPago === 'efectivo') {
          totalEfectivo += total;
        } else if (comanda.formaPago === 'qr') {
          totalQr += total;
        } else if (comanda.formaPago === 'mixto') {
          totalMixto += total;
          totalEfectivo += parseFloat(comanda.cantidadEfectivo || 0);
          totalQr += parseFloat(comanda.cantidadQr || 0);
        }
      } else {
        comandasAbiertas++;
      }
    });
    
    // Convertir objeto a array
    const mesasArray = Object.values(mesasReporte);
    
    res.json({
      inicioDia,
      finDia,
      mesas: mesasArray,
      totales: {
        totalDia: totalDia.toFixed(2),
        totalEfectivo: totalEfectivo.toFixed(2),
        totalQr: totalQr.toFixed(2),
        totalMixto: totalMixto.toFixed(2),
        comandasCerradas,
        comandasAbiertas
      }
    });
    
  } catch (error) {
    console.error('Error en getReporteDiaMesero:', error);
    res.status(500).json({ 
      message: 'Error al obtener reporte del día',
      error: error.message 
    });
  }
};

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

    // Hacemos la consulta directamente combinando comandas/pedidos/productos para poder filtrar por rango de fechas
    const replacements = { limit: parseInt(limit) };
    let whereClause = `WHERE c.estado = 'cerrada'`;

    if (fechaInicio && fechaFin) {
      whereClause += ` AND DATE(c.fecha) BETWEEN :fechaInicio AND :fechaFin`;
      replacements.fechaInicio = fechaInicio;
      replacements.fechaFin = fechaFin;
    }

    const productos = await sequelize.query(
      `SELECT
         p.id,
         p.nombre,
         p.categoria,
         p.precio,
         SUM(ped.cantidad) as total_vendido,
         SUM(ped.subtotal) as ingresos_generados,
         COUNT(DISTINCT ped.comanda_id) as comandas_incluido
       FROM productos p
       INNER JOIN pedidos ped ON p.id = ped.producto_id
       INNER JOIN comandas c ON ped.comanda_id = c.id
       ${whereClause}
       GROUP BY p.id, p.nombre, p.categoria, p.precio
       ORDER BY total_vendido DESC
       LIMIT :limit`,
      { replacements, type: QueryTypes.SELECT }
    );

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

    // Generar ventas por producto con filtrado por fechas sobre comandas
    const replacements = {};
    let whereClauses = `WHERE c.estado = 'cerrada'`;

    if (fechaInicio && fechaFin) {
      whereClauses += ` AND DATE(c.fecha) BETWEEN :fechaInicio AND :fechaFin`;
      replacements.fechaInicio = fechaInicio;
      replacements.fechaFin = fechaFin;
    }

    if (categoria) {
      whereClauses += ` AND p.categoria = :categoria`;
      replacements.categoria = categoria;
    }

    const ventas = await sequelize.query(
      `SELECT
         p.id as producto_id,
         p.nombre as producto_nombre,
         p.precio as precio_venta,
         p.costo,
         pr.nombre as proveedor,
         COUNT(ped.id) as total_pedidos,
         SUM(ped.cantidad) as cantidad_vendida,
         SUM(ped.subtotal) as total_ventas,
         SUM(ped.cantidad * p.costo) as costo_total,
         SUM(ped.subtotal) - SUM(ped.cantidad * p.costo) as ganancia_neta
      FROM productos p
      LEFT JOIN pedidos ped ON p.id = ped.producto_id
      LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
      LEFT JOIN comandas c ON ped.comanda_id = c.id
      ${whereClauses}
      GROUP BY p.id, p.nombre, p.precio, p.costo, pr.nombre
      ORDER BY total_ventas DESC`,
      { replacements, type: QueryTypes.SELECT }
    );

    const totalIngresos = ventas.reduce((sum, v) => sum + parseFloat(v.total_ventas || 0), 0);
    const totalUnidades = ventas.reduce((sum, v) => sum + parseInt(v.cantidad_vendida || 0), 0);

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

    // Calculamos ventas por mesa usando comandas para permitir filtrado por fechas
    const replacements = {};
    let whereClauses = `WHERE c.estado = 'cerrada'`;

    if (fechaInicio && fechaFin) {
      whereClauses += ` AND DATE(c.fecha) BETWEEN :fechaInicio AND :fechaFin`;
      replacements.fechaInicio = fechaInicio;
      replacements.fechaFin = fechaFin;
    }

    const ventas = await sequelize.query(
      `SELECT
         m.id as mesa_id,
         m.nombre as mesa_nombre,
         m.numero as mesa_numero,
         COUNT(DISTINCT c.id) as total_comandas,
         SUM(c.total) as total_vendido,
         AVG(c.total) as promedio_por_comanda,
         MAX(c.fecha) as ultima_comanda
       FROM mesas m
       LEFT JOIN comandas c ON m.id = c.mesa_id
       ${whereClauses}
       GROUP BY m.id, m.nombre, m.numero
       ORDER BY total_vendido DESC`,
      { replacements, type: QueryTypes.SELECT }
    );

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

// Resumen por rango (ej. semanal) — monto adeudado por proveedor según costo de productos vendidos
const getPagosSemanaProveedores = async (req, res) => {
  try {
    const adminUser = req.user;
    const { localId: qLocalId, startDate, endDate, proveedorId } = req.query;

    let localId = qLocalId || adminUser.localId || null;
    if (!localId) {
      const locales = await Local.findAll({ where: { usuarioPropietarioId: adminUser.id }, attributes: ['id'] });
      if (locales && locales.length > 0) localId = locales[0].id;
    }
    if (!localId) return res.status(400).json({ success: false, message: 'LocalId requerido' });

    // interpret startDate/endDate as business-day dates (YYYY-MM-DD) — day defined as 06:00→06:00
    const now = new Date();
    // default last 7 business-days
    const start = startDate || (() => { const d = new Date(now); d.setDate(d.getDate()-7); return d.toISOString().split('T')[0]; })();
    const end = endDate || (() => { const d = new Date(now); return d.toISOString().split('T')[0]; })();

    let whereProveedor = '';
    const replacements = { localId, startDate: start, endDate: end };
    if (proveedorId) {
      whereProveedor = ' AND pr.id = :proveedorId';
      replacements.proveedorId = proveedorId;
    }

    const query = `
      SELECT pr.id as proveedor_id, pr.nombre as proveedor, pr.telefono, pr.email,
             SUM(ped.cantidad * p.costo)::numeric(12,2) as monto_adeudado,
             SUM(ped.cantidad) as unidades_vendidas,
             COUNT(DISTINCT c.id) as comandas
      FROM proveedores pr
      JOIN productos p ON p.proveedor_id = pr.id AND p.local_id = :localId
      JOIN pedidos ped ON ped.producto_id = p.id
      JOIN comandas c ON ped.comanda_id = c.id
      -- Use business-day window: shift created_at by -6 hours and compare date to provided start/end YYYY-MM-DD
      WHERE c.estado = 'cerrada' AND ((c.created_at - interval '6 hours')::date) BETWEEN :startDate AND :endDate ${whereProveedor}
      GROUP BY pr.id, pr.nombre, pr.telefono, pr.email
      ORDER BY monto_adeudado DESC
    `;

    const rows = await sequelize.query(query, { replacements, type: QueryTypes.SELECT });

    const total = rows.reduce((s, r) => s + parseFloat(r.monto_adeudado || 0), 0);

    res.json({ success: true, data: { proveedores: rows, resumen: { total: total.toFixed(2), periodo: { inicio: start, fin: end } } } });
  } catch (error) {
    console.error('Error en getPagosSemanaProveedores:', error);
    res.status(500).json({ success: false, message: 'Error al calcular pagos por proveedor', error: error.message });
  }
};

// Detalle por proveedor: productos vendidos y monto adeudado por producto en el rango
const getDetalleProveedor = async (req, res) => {
  try {
    const adminUser = req.user;
    const { id: proveedorId } = req.params;
    const { localId: qLocalId, startDate, endDate } = req.query;

    if (!proveedorId) return res.status(400).json({ success: false, message: 'ProveedorId requerido' });

    let localId = qLocalId || adminUser.localId || null;
    if (!localId) {
      const locales = await Local.findAll({ where: { usuarioPropietarioId: adminUser.id }, attributes: ['id'] });
      if (locales && locales.length > 0) localId = locales[0].id;
    }
    if (!localId) return res.status(400).json({ success: false, message: 'LocalId requerido' });

    // Use business-day date strings for filtering
    const now = new Date();
    const start = startDate || (() => { const d = new Date(now); d.setDate(d.getDate()-7); return d.toISOString().split('T')[0]; })();
    const end = endDate || (() => { const d = new Date(now); return d.toISOString().split('T')[0]; })();

    const query = `
      SELECT p.id as producto_id, p.nombre as producto, SUM(ped.cantidad) as unidades_vendidas, SUM(ped.cantidad * p.costo)::numeric(12,2) as monto_adeudado, COUNT(DISTINCT c.id) as comandas
      FROM productos p
      JOIN pedidos ped ON ped.producto_id = p.id
      JOIN comandas c ON ped.comanda_id = c.id
      WHERE p.proveedor_id = :proveedorId AND p.local_id = :localId AND c.estado = 'cerrada' AND ((c.created_at - interval '6 hours')::date) BETWEEN :startDate AND :endDate
      GROUP BY p.id, p.nombre
      ORDER BY monto_adeudado DESC
    `;

    const rows = await sequelize.query(query, { replacements: { proveedorId, localId, startDate: start, endDate: end }, type: QueryTypes.SELECT });

    const total = rows.reduce((s, r) => s + parseFloat(r.monto_adeudado || 0), 0);

    res.json({ success: true, data: { proveedor: proveedorId, productos: rows, resumen: { total: total.toFixed(2), periodo: { inicio: start, fin: end } } } });
  } catch (err) {
    console.error('Error en getDetalleProveedor:', err);
    res.status(500).json({ success: false, message: 'Error al obtener detalle del proveedor', error: err.message });
  }
};

// Reporte de rendimiento de meseros
const getRendimientoMeseros = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;

    // Calcular rendimiento por mesero usando comandas directamente para permitir filtrado por fechas
    const replacements = {};
    let whereClause = `WHERE u.tipo = 'atencion' AND c.estado = 'cerrada'`;

    if (fechaInicio && fechaFin) {
      whereClause += ` AND DATE(c.fecha) BETWEEN :fechaInicio AND :fechaFin`;
      replacements.fechaInicio = fechaInicio;
      replacements.fechaFin = fechaFin;
    }

    const rendimiento = await sequelize.query(
      `SELECT
         u.id as usuario_id,
         u.nombre as mesero,
         COUNT(DISTINCT c.id) as total_comandas,
         SUM(c.total) as total_ventas,
         AVG(c.total) as promedio_por_comanda,
         COUNT(DISTINCT DATE(c.fecha)) as dias_trabajados
       FROM usuarios u
       INNER JOIN comandas c ON u.id = c.usuario_atencion_id
       ${whereClause}
       GROUP BY u.id, u.nombre
       ORDER BY total_ventas DESC`,
      { replacements, type: QueryTypes.SELECT }
    );

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

// Obtener reportes diarios (6AM-6AM) para el admin: comandas generadas por los usuarios del mismo local
const getReportesDiariosLocal = async (req, res) => {
  try {
    const adminUser = req.user;

    // Determinar local objetivo: preferir query param, luego req.user.localId, luego el primer local propietario del admin
    let localId = req.query.localId || adminUser.localId || null;

    if (!localId) {
      // intentar obtener el primer local cuyo propietario sea el admin
      const locales = await Local.findAll({ where: { usuarioPropietarioId: adminUser.id }, attributes: ['id'] });
      if (locales && locales.length > 0) {
        localId = locales[0].id;
      }
    }

    if (!localId) {
      // No hay local disponible para el admin
      return res.status(400).json({ success: false, message: 'No se encontró un local objetivo para generar reportes. Proporciona ?localId o configura un local para el usuario admin.' });
    }

    // Calcular inicio y fin del día (6 AM a 6 AM)
    // Soporta ?date=YYYY-MM-DD para solicitar un día específico
    const { date } = req.query || {};
    let inicioDia;
    if (date) {
      // Interpretar la fecha como YYYY-MM-DD y empezar a las 06:00
      inicioDia = new Date(date + 'T06:00:00');
      // fallback parse if invalid
      if (isNaN(inicioDia.getTime())) {
        inicioDia = new Date();
        inicioDia.setHours(6, 0, 0, 0);
        if ((new Date()).getHours() < 6) inicioDia.setDate(inicioDia.getDate() - 1);
      }
    } else {
      const ahora = new Date();
      inicioDia = new Date(ahora);
      inicioDia.setHours(6, 0, 0, 0);
      if (ahora.getHours() < 6) {
        inicioDia.setDate(inicioDia.getDate() - 1);
      }
    }
    const finDia = new Date(inicioDia);
    finDia.setDate(finDia.getDate() + 1);

    // obtener todos los usuarios del local con tipo atencion/cocina/bar
    const usuarios = await Usuario.findAll({
      where: {
        localId,
        tipo: { [Op.in]: ['atencion', 'cocina', 'bar'] }
      },
      attributes: ['id', 'nombre', 'tipo']
    });

    if (!usuarios || usuarios.length === 0) {
      return res.json({ inicioDia, finDia, usuarios: [], totales: { totalDia: 0, totalEfectivo: 0, totalQr: 0, totalMixto: 0 } });
    }

    const usuarioIds = usuarios.map(u => u.id);

    // Obtener comandas del día por los usuarios del local
    const comandas = await Comanda.findAll({
      where: {
        usuarioAtencionId: { [Op.in]: usuarioIds },
        createdAt: { [Op.gte]: inicioDia, [Op.lt]: finDia }
      },
      include: [
        { model: Usuario, as: 'usuarioAtencion', attributes: ['id', 'nombre', 'tipo'] },
        { model: Mesa, as: 'mesa', attributes: ['id', 'numero'] },
        { model: Pedido, as: 'pedidos', include: [ { model: Producto, as: 'producto', attributes: ['id','nombre','precio'] } ] }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Agrupar por usuario
    const usuariosReporte = {};
    let totalDia = 0;
    let totalEfectivo = 0;
    let totalQr = 0;
    let totalMixto = 0;

    comandas.forEach(comanda => {
      const u = comanda.usuarioAtencion;
      const uid = u ? u.id : 'sin-usuario';
      const uNombre = u ? u.nombre : 'Sin usuario';
      const uTipo = u ? u.tipo : 'desconocido';

      if (!usuariosReporte[uid]) {
        usuariosReporte[uid] = {
          id: uid,
          nombre: uNombre,
          tipo: uTipo,
          comandas: [],
          totalUsuario: 0
        };
      }

      const comandaObj = {
        id: comanda.id,
        mesa: comanda.mesa ? { id: comanda.mesa.id, numero: comanda.mesa.numero } : null,
        estado: comanda.estado,
        total: parseFloat(comanda.total || 0),
        formaPago: comanda.formaPago,
        cantidadEfectivo: parseFloat(comanda.cantidadEfectivo || 0),
        cantidadQr: parseFloat(comanda.cantidadQr || 0),
        comprobante: comanda.comprobante,
        createdAt: comanda.createdAt,
        pedidos: comanda.pedidos.map(p => ({
          id: p.id,
          cantidad: p.cantidad,
          precioUnitario: parseFloat(p.precioUnitario),
          subtotal: parseFloat(p.subtotal),
          estado: p.estado,
          producto: p.producto ? { nombre: p.producto.nombre, precio: parseFloat(p.producto.precio) } : null
        }))
      };

      usuariosReporte[uid].comandas.push(comandaObj);

      if (comanda.estado === 'cerrada') {
        const total = parseFloat(comanda.total || 0);
        usuariosReporte[uid].totalUsuario += total;
        totalDia += total;

        if (comanda.formaPago === 'efectivo') {
          totalEfectivo += total;
        } else if (comanda.formaPago === 'qr') {
          totalQr += total;
        } else if (comanda.formaPago === 'mixto') {
          totalMixto += total;
          totalEfectivo += parseFloat(comanda.cantidadEfectivo || 0);
          totalQr += parseFloat(comanda.cantidadQr || 0);
        }
      }
    });

    const usuariosArray = Object.values(usuariosReporte);

    res.json({
      inicioDia,
      finDia,
      usuarios: usuariosArray,
      totales: {
        totalDia: totalDia.toFixed(2),
        totalEfectivo: totalEfectivo.toFixed(2),
        totalQr: totalQr.toFixed(2),
        totalMixto: totalMixto.toFixed(2)
      }
    });
  } catch (error) {
    console.error('Error en getReportesDiariosLocal:', error);
    res.status(500).json({ success: false, message: 'Error al obtener reportes diarios del local', error: error.message });
  }
};

// Devuelve los días dentro de un rango (últimos N días) que tienen comandas para el local
const getDiasConReportesLocal = async (req, res) => {
  try {
    const adminUser = req.user;
    const { days = 30 } = req.query;

    // Determinar local objetivo (acepta ?localId)
    let localId = req.query.localId || adminUser.localId || null;
    if (!localId) {
      const locales = await Local.findAll({ where: { usuarioPropietarioId: adminUser.id }, attributes: ['id'] });
      if (locales && locales.length > 0) localId = locales[0].id;
    }

    if (!localId) {
      return res.status(400).json({ success: false, message: 'No se encontró local objetivo (proporciona localId o configura un local para el admin).' });
    }

    const ahora = new Date();
    // inicioDia como hoy a las 6AM según regla del negocio
    let inicioDia = new Date(ahora);
    inicioDia.setHours(6, 0, 0, 0);
    if (ahora.getHours() < 6) inicioDia.setDate(inicioDia.getDate() - 1);

    // rango de búsqueda: desde inicioDia - (days-1) hasta inicioDia + 1 (incluir hoy)
    const inicioRango = new Date(inicioDia);
    inicioRango.setDate(inicioRango.getDate() - (parseInt(days) - 1));
    const finRango = new Date(inicioDia);
    finRango.setDate(finRango.getDate() + 1);

    // Consulta eficiente: ajustar created_at restando 6 horas y agrupar por fecha resultante
    const query = `
      SELECT ((created_at - interval '6 hours')::date) AS reporte_fecha, COUNT(*) as total
      FROM comandas
      WHERE local_id = :localId
        AND created_at >= :inicio
        AND created_at < :fin
      GROUP BY reporte_fecha
      ORDER BY reporte_fecha DESC
    `;

    const dias = await sequelize.query(query, {
      replacements: {
        localId,
        inicio: inicioRango.toISOString(),
        fin: finRango.toISOString()
      },
      type: QueryTypes.SELECT
    });

    // Formatear fechas en YYYY-MM-DD para frontend
    const result = dias.map(d => {
      const rf = d.reporte_fecha;
      let dateStr = null;
      if (!rf && rf !== 0) dateStr = null;
      else if (typeof rf === 'string') dateStr = rf;
      else if (rf instanceof Date) dateStr = rf.toISOString().split('T')[0];
      else dateStr = new Date(rf).toISOString().split('T')[0];

      return { date: dateStr, total: parseInt(d.total) };
    }).filter(x => x.date !== null);

    res.json({ success: true, days: result });
  } catch (error) {
    console.error('Error en getDiasConReportesLocal:', error);
    res.status(500).json({ success: false, message: 'Error al obtener días con reportes', error: error.message });
  }
};

/**
 * Generar y guardar un reporte diario para un local y fecha (fecha en YYYY-MM-DD)
 * Retorna el objeto del reporte creado o actualizado.
 */
const crearReporteDiario = async (req, res) => {
  try {
    const adminUser = req.user;
    const { localId: qLocalId, date } = req.query;

    // determinar target local similar a otras funciones
    let localId = qLocalId || adminUser.localId || null;
    if (!localId) {
      const locales = await Local.findAll({ where: { usuarioPropietarioId: adminUser.id }, attributes: ['id'] });
      if (locales && locales.length > 0) localId = locales[0].id;
    }
    if (!localId) return res.status(400).json({ success: false, message: 'Local objetivo no encontrado' });

    // fecha objetivo (YYYY-MM-DD) -> inicio a las 06:00
    const fechaTarget = date || (new Date()).toISOString().split('T')[0];
    const inicio = new Date(fechaTarget + 'T06:00:00');
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 1);

    // Obtener usuarios del local
    const usuarios = await Usuario.findAll({ where: { localId, tipo: { [Op.in]: ['atencion', 'cocina', 'bar'] } }, attributes: ['id','nombre','tipo'] });
    const usuarioIds = usuarios.map(u => u.id);

    // Buscar comandas por usuarios del local en el rango
    const comandas = await Comanda.findAll({
      where: {
        usuarioAtencionId: { [Op.in]: usuarioIds },
        createdAt: { [Op.gte]: inicio, [Op.lt]: fin }
      },
      include: [
        { model: Usuario, as: 'usuarioAtencion', attributes: ['id', 'nombre', 'tipo'] },
        { model: Mesa, as: 'mesa', attributes: ['id', 'numero'] },
        { model: Pedido, as: 'pedidos', include: [ { model: Producto, as: 'producto', attributes: ['id','nombre','precio'] } ] }
      ],
      order: [['createdAt','DESC']]
    });

    // Agrupar por usuario y calcular totales (mismo formato que getReportesDiariosLocal)
    const usuariosReporte = {};
    let totalDia = 0, totalEfectivo = 0, totalQr = 0, totalMixto = 0;

    comandas.forEach(comanda => {
      const u = comanda.usuarioAtencion;
      const uid = u ? u.id : 'sin-usuario';
      const uNombre = u ? u.nombre : 'Sin usuario';
      const uTipo = u ? u.tipo : 'desconocido';
      if (!usuariosReporte[uid]) {
        usuariosReporte[uid] = { id: uid, nombre: uNombre, tipo: uTipo, comandas: [], totalUsuario: 0 };
      }

      const comandaObj = {
        id: comanda.id,
        mesa: comanda.mesa ? { id: comanda.mesa.id, numero: comanda.mesa.numero } : null,
        estado: comanda.estado,
        total: parseFloat(comanda.total || 0),
        formaPago: comanda.formaPago,
        cantidadEfectivo: parseFloat(comanda.cantidadEfectivo || 0),
        cantidadQr: parseFloat(comanda.cantidadQr || 0),
        comprobante: comanda.comprobante,
        createdAt: comanda.createdAt,
        pedidos: comanda.pedidos.map(p => ({ id: p.id, cantidad: p.cantidad, precioUnitario: parseFloat(p.precioUnitario), subtotal: parseFloat(p.subtotal), estado: p.estado, producto: p.producto ? { nombre: p.producto.nombre, precio: parseFloat(p.producto.precio) } : null }))
      };

      usuariosReporte[uid].comandas.push(comandaObj);
      if (comanda.estado === 'cerrada') {
        const total = parseFloat(comanda.total || 0);
        usuariosReporte[uid].totalUsuario += total;
        totalDia += total;
        if (comanda.formaPago === 'efectivo') totalEfectivo += total;
        else if (comanda.formaPago === 'qr') totalQr += total;
        else if (comanda.formaPago === 'mixto') { totalMixto += total; totalEfectivo += parseFloat(comanda.cantidadEfectivo || 0); totalQr += parseFloat(comanda.cantidadQr || 0); }
      }
    });

    const usuariosArray = Object.values(usuariosReporte);

    // Guardar o actualizar en tabla reportes_diarios
    const { ReporteDiario } = require('../models');

    const payload = {
      localId,
      fecha: fechaTarget,
      data: {
        inicioDia: inicio,
        finDia: fin,
        usuarios: usuariosArray,
        totales: { totalDia: totalDia.toFixed(2), totalEfectivo: totalEfectivo.toFixed(2), totalQr: totalQr.toFixed(2), totalMixto: totalMixto.toFixed(2) }
      }
    };

    // Si existe reporte para local+fecha, actualizar; sino crear
    let reporte = await ReporteDiario.findOne({ where: { localId, fecha: fechaTarget } });
    if (reporte) {
      reporte.data = payload.data;
      await reporte.save();
    } else {
      reporte = await ReporteDiario.create(payload);
    }

    res.json({ success: true, reporte });
  } catch (error) {
    console.error('Error en crearReporteDiario:', error);
    res.status(500).json({ success: false, message: 'Error al crear reporte diario', error: error.message });
  }
};

// Generar y guardar reporte (función util para uso interno y scheduler)
const generarYGuardarReporte = async (localId, fechaTarget) => {
  // fechaTarget expected YYYY-MM-DD
  try {
    const inicio = new Date(fechaTarget + 'T06:00:00');
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 1);

    const usuarios = await Usuario.findAll({ where: { localId, tipo: { [Op.in]: ['atencion', 'cocina', 'bar'] } }, attributes: ['id','nombre','tipo'] });
    const usuarioIds = usuarios.map(u => u.id);

    const comandas = await Comanda.findAll({
      where: { usuarioAtencionId: { [Op.in]: usuarioIds }, createdAt: { [Op.gte]: inicio, [Op.lt]: fin } },
      include: [ { model: Usuario, as: 'usuarioAtencion', attributes: ['id','nombre','tipo'] }, { model: Mesa, as: 'mesa', attributes: ['id','numero'] }, { model: Pedido, as: 'pedidos', include: [ { model: Producto, as: 'producto', attributes: ['id','nombre','precio'] } ] } ],
      order: [['createdAt','DESC']]
    });

    const usuariosReporte = {};
    let totalDia = 0, totalEfectivo = 0, totalQr = 0, totalMixto = 0;

    comandas.forEach(comanda => {
      const u = comanda.usuarioAtencion;
      const uid = u ? u.id : 'sin-usuario';
      const uNombre = u ? u.nombre : 'Sin usuario';
      const uTipo = u ? u.tipo : 'desconocido';
      if (!usuariosReporte[uid]) usuariosReporte[uid] = { id: uid, nombre: uNombre, tipo: uTipo, comandas: [], totalUsuario: 0 };

      const comandaObj = {
        id: comanda.id,
        mesa: comanda.mesa ? { id: comanda.mesa.id, numero: comanda.mesa.numero } : null,
        estado: comanda.estado,
        total: parseFloat(comanda.total || 0),
        formaPago: comanda.formaPago,
        cantidadEfectivo: parseFloat(comanda.cantidadEfectivo || 0),
        cantidadQr: parseFloat(comanda.cantidadQr || 0),
        comprobante: comanda.comprobante,
        createdAt: comanda.createdAt,
        pedidos: comanda.pedidos.map(p => ({ id: p.id, cantidad: p.cantidad, precioUnitario: parseFloat(p.precioUnitario), subtotal: parseFloat(p.subtotal), estado: p.estado, producto: p.producto ? { nombre: p.producto.nombre, precio: parseFloat(p.producto.precio) } : null }))
      };

      usuariosReporte[uid].comandas.push(comandaObj);
      if (comanda.estado === 'cerrada') {
        const total = parseFloat(comanda.total || 0);
        usuariosReporte[uid].totalUsuario += total;
        totalDia += total;
        if (comanda.formaPago === 'efectivo') totalEfectivo += total;
        else if (comanda.formaPago === 'qr') totalQr += total;
        else if (comanda.formaPago === 'mixto') { totalMixto += total; totalEfectivo += parseFloat(comanda.cantidadEfectivo || 0); totalQr += parseFloat(comanda.cantidadQr || 0); }
      }
    });

    const usuariosArray = Object.values(usuariosReporte);
    const { ReporteDiario } = require('../models');

    const payload = {
      localId,
      fecha: fechaTarget,
      data: { inicioDia: inicio, finDia: fin, usuarios: usuariosArray, totales: { totalDia: totalDia.toFixed(2), totalEfectivo: totalEfectivo.toFixed(2), totalQr: totalQr.toFixed(2), totalMixto: totalMixto.toFixed(2) } }
    };

    let reporte = await ReporteDiario.findOne({ where: { localId, fecha: fechaTarget } });
    if (reporte) {
      reporte.data = payload.data;
      await reporte.save();
    } else {
      reporte = await ReporteDiario.create(payload);
    }

    return reporte;
  } catch (err) {
    console.error('Error generarYGuardarReporte:', err);
    throw err;
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

    // Top 5 productos del mes (agregado por fecha en comandas)
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    // Usamos las tablas reales (pedidos + comandas + productos) para calcular los top del mes
    const topProductos = await sequelize.query(
      `SELECT
         pr.id as id,
         pr.nombre as producto_nombre,
         pr.categoria as categoria,
         SUM(p.cantidad) as total_vendido,
         SUM(p.subtotal) as ingresos_generados
       FROM pedidos p
       INNER JOIN comandas c ON p.comanda_id = c.id
       INNER JOIN productos pr ON p.producto_id = pr.id
       WHERE c.estado = 'cerrada'
         AND DATE(c.fecha) BETWEEN :inicioMes AND :hoy
       GROUP BY pr.id, pr.nombre, pr.categoria
       ORDER BY total_vendido DESC
       LIMIT 5`,
      {
        replacements: { inicioMes, hoy },
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
  getReporteDiaMesero,
  getVentasPorPeriodo,
  getProductosMasVendidos,
  getVentasPorProducto,
  getVentasPorMesa,
  getPagosPendientesProveedores,
  getPagosSemanaProveedores,
  getDetalleProveedor,
  getRendimientoMeseros,
  getEstadoComandas,
  getInventarioProveedores,
  getDashboardResumen,
  getReportePorPeriodo
  ,
  getReportesDiariosLocal
  ,
  getDiasConReportesLocal
  ,
  crearReporteDiario,
  generarYGuardarReporte
};
