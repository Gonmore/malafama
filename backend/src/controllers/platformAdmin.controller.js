const crypto = require('crypto');

const { Op } = require('sequelize');
const { Usuario, Tenant } = require('../models');

function parsePositiveInt(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function getReferenciaTenant() {
  const referencia = await Tenant.findOne({ where: { esReferencia: true, activo: true } });
  if (referencia) return referencia;

  // Fallback: any tenant as reference
  const anyTenant = await Tenant.findOne({ where: { activo: true } });
  return anyTenant;
}

const crearTenant = async (req, res) => {
  try {
    const {
      tenantNombre,
      adminNombre,
      adminEmail,
      adminPassword,
      suscripcionDias,
      maxLocales,
    } = req.body;

    if (!tenantNombre || !adminNombre || !adminEmail) {
      return res.status(400).json({
        success: false,
        message: 'tenantNombre, adminNombre y adminEmail son requeridos',
      });
    }

    const dias = parsePositiveInt(suscripcionDias, null);
    if (!dias) {
      return res.status(400).json({
        success: false,
        message: 'suscripcionDias debe ser un entero positivo',
      });
    }

    const max = parsePositiveInt(maxLocales, null);
    if (!max) {
      return res.status(400).json({
        success: false,
        message: 'maxLocales debe ser un entero positivo',
      });
    }

    const referenciaTenant = await getReferenciaTenant();
    if (!referenciaTenant) {
      return res.status(500).json({
        success: false,
        message: 'No existe tenant de referencia. Ejecuta init-platform-admin primero.',
      });
    }

    const existing = await Usuario.findOne({ where: { email: adminEmail } });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'El email del admin del tenant ya está registrado',
      });
    }

    const passwordToUse = adminPassword || crypto.randomBytes(12).toString('base64url');

    const usuarioAdmin = await Usuario.create({
      nombre: adminNombre,
      email: adminEmail,
      password: passwordToUse,
      tipo: 'admin',
      activo: true,
      onboarding_completado: false,
      localId: null,
    });

    const tenant = await Tenant.create({
      nombre: tenantNombre,
      adminUsuarioId: usuarioAdmin.id,
      referenciaTenantId: referenciaTenant.id,
      esReferencia: false,
      planDefault: referenciaTenant.planDefault,
      monedaDefault: referenciaTenant.monedaDefault,
      suscripcionHasta: addDays(new Date(), dias),
      maxLocales: max,
      activo: true,
      createdByPlatformAdminId: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: 'Tenant creado correctamente',
      data: {
        tenant,
        admin: {
          id: usuarioAdmin.id,
          nombre: usuarioAdmin.nombre,
          email: usuarioAdmin.email,
          password: adminPassword ? '(provisto)' : passwordToUse,
        },
      },
    });
  } catch (error) {
    // Handle unique constraint errors more nicely
    const msg = error?.message || String(error);
    const isUnique = /unique|duplicate|violates unique/i.test(msg);
    return res.status(isUnique ? 400 : 500).json({
      success: false,
      message: isUnique ? 'Ya existe un tenant/admin con esos datos' : 'Error al crear tenant',
      error: msg,
    });
  }
};

const listarTenants = async (req, res) => {
  try {
    const activo = req.query.activo;
    // Por defecto devolvemos solo tenants activos (habilitados), que es lo que
    // normalmente espera ver el platform_admin al loguear.
    let where = { activo: true };
    if (activo === 'true') where = { activo: true };
    if (activo === 'false') where = { activo: false };
    if (activo === 'all') where = {};

    const tenants = await Tenant.findAll({
      where,
      order: [['created_at', 'DESC']],
      include: [
        {
          model: Usuario,
          as: 'adminUsuario',
          attributes: ['id', 'nombre', 'email', 'tipo', 'activo', 'created_at'],
        },
      ],
    });

    return res.json({
      success: true,
      data: { tenants },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error al listar tenants',
      error: error.message,
    });
  }
};

const obtenerTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const tenant = await Tenant.findByPk(id, {
      include: [
        {
          model: Usuario,
          as: 'adminUsuario',
          attributes: ['id', 'nombre', 'email', 'tipo', 'activo', 'created_at'],
        },
      ],
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant no encontrado',
      });
    }

    return res.json({
      success: true,
      data: { tenant },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error al obtener tenant',
      error: error.message,
    });
  }
};

const actualizarTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tenantNombre,
      suscripcionHasta,
      suscripcionDias,
      maxLocales,
      activo,
      adminNombre,
      adminEmail,
      adminPassword,
    } = req.body;

    const tenant = await Tenant.findByPk(id);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant no encontrado',
      });
    }

    if (tenant.esReferencia) {
      return res.status(400).json({
        success: false,
        message: 'El tenant de referencia es de solo lectura',
      });
    }

    if (tenantNombre !== undefined) {
      if (!tenantNombre) {
        return res.status(400).json({ success: false, message: 'tenantNombre no puede ser vacío' });
      }
      tenant.nombre = tenantNombre;
    }

    if (maxLocales !== undefined) {
      const max = parsePositiveInt(maxLocales, null);
      if (!max) {
        return res.status(400).json({ success: false, message: 'maxLocales debe ser un entero positivo' });
      }
      tenant.maxLocales = max;
    }

    if (activo !== undefined) {
      tenant.activo = Boolean(activo);
    }

    if (suscripcionDias !== undefined && suscripcionDias !== null && suscripcionDias !== '') {
      const dias = parsePositiveInt(suscripcionDias, null);
      if (!dias) {
        return res.status(400).json({ success: false, message: 'suscripcionDias debe ser un entero positivo' });
      }
      tenant.suscripcionHasta = addDays(new Date(), dias);
    } else if (suscripcionHasta !== undefined) {
      const date = new Date(suscripcionHasta);
      if (Number.isNaN(date.getTime())) {
        return res.status(400).json({ success: false, message: 'suscripcionHasta inválido' });
      }
      tenant.suscripcionHasta = date;
    }

    await tenant.save();

    // Update associated admin user (optional)
    if (adminNombre !== undefined || adminEmail !== undefined || adminPassword !== undefined) {
      const adminUsuario = await Usuario.findByPk(tenant.adminUsuarioId);
      if (!adminUsuario) {
        return res.status(500).json({ success: false, message: 'Admin del tenant no encontrado' });
      }

      if (adminNombre !== undefined) {
        if (!adminNombre) {
          return res.status(400).json({ success: false, message: 'adminNombre no puede ser vacío' });
        }
        adminUsuario.nombre = adminNombre;
      }

      if (adminEmail !== undefined) {
        if (!adminEmail) {
          return res.status(400).json({ success: false, message: 'adminEmail no puede ser vacío' });
        }
        const existing = await Usuario.findOne({
          where: {
            email: adminEmail,
            id: { [Op.ne]: adminUsuario.id },
          },
        });
        if (existing) {
          return res.status(400).json({ success: false, message: 'adminEmail ya está registrado' });
        }
        adminUsuario.email = adminEmail;
      }

      if (adminPassword !== undefined && adminPassword) {
        adminUsuario.password = adminPassword;
      }

      await adminUsuario.save();
    }

    // Si el tenant se activó/desactivó, reflejar en el usuario admin asociado
    if (activo !== undefined) {
      const adminUsuario = await Usuario.findByPk(tenant.adminUsuarioId);
      if (adminUsuario) {
        adminUsuario.activo = Boolean(tenant.activo);
        await adminUsuario.save();
      }
    }

    const refreshed = await Tenant.findByPk(tenant.id, {
      include: [
        {
          model: Usuario,
          as: 'adminUsuario',
          attributes: ['id', 'nombre', 'email', 'tipo', 'activo', 'created_at'],
        },
      ],
    });

    return res.json({
      success: true,
      message: 'Tenant actualizado',
      data: { tenant: refreshed },
    });
  } catch (error) {
    const msg = error?.message || String(error);
    const isUnique = /unique|duplicate|violates unique/i.test(msg);
    return res.status(isUnique ? 400 : 500).json({
      success: false,
      message: isUnique ? 'Conflicto de datos (duplicado)' : 'Error al actualizar tenant',
      error: msg,
    });
  }
};

const eliminarTenant = async (req, res) => {
  try {
    const { id } = req.params;

    const tenant = await Tenant.findByPk(id);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant no encontrado',
      });
    }

    if (tenant.esReferencia) {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar el tenant de referencia',
      });
    }

    // Soft-delete: desactivar tenant y su admin
    tenant.activo = false;
    await tenant.save();

    const adminUsuario = await Usuario.findByPk(tenant.adminUsuarioId);
    if (adminUsuario) {
      adminUsuario.activo = false;
      await adminUsuario.save();
    }

    return res.json({
      success: true,
      message: 'Tenant eliminado',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error al eliminar tenant',
      error: error.message,
    });
  }
};

// Minimal: allow platform admin to see its reference tenant id
const getReferencia = async (req, res) => {
  const referenciaTenant = await getReferenciaTenant();
  return res.json({
    success: true,
    data: {
      referenciaTenant,
    },
  });
};

module.exports = {
  crearTenant,
  getReferencia,
  listarTenants,
  obtenerTenant,
  actualizarTenant,
  eliminarTenant,
};
