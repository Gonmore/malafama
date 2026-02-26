require('dotenv').config();

const crypto = require('crypto');

const { sequelize } = require('../src/config/database');
const { Usuario, Tenant } = require('../src/models');

function requireEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function parseIntSafe(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

async function init() {
  const platformAdminEmail = process.env.PLATFORM_ADMIN_EMAIL || 'admin@supernovatel.com';
  const platformAdminName = process.env.PLATFORM_ADMIN_NAME || 'Platform Admin';

  const providedPassword = process.env.PLATFORM_ADMIN_PASSWORD;
  const rawPassword = providedPassword || crypto.randomBytes(12).toString('base64url');

  const referenciaTenantNombre = process.env.REFERENCIA_TENANT_NOMBRE || 'Tenant Admin (Referencia)';
  const referenciaPlanDefault = process.env.REFERENCIA_TENANT_PLAN_DEFAULT || 'gratuito';
  const referenciaMonedaDefault = process.env.REFERENCIA_TENANT_MONEDA_DEFAULT || 'Bs';
  const referenciaMaxLocales = parseIntSafe(process.env.REFERENCIA_TENANT_MAX_LOCALES, 999999);
  const referenciaSuscripcionDays = parseIntSafe(process.env.REFERENCIA_TENANT_SUSCRIPCION_DIAS, 36500);

  await sequelize.authenticate();

  // Ensure models are synced in dev. In prod, we expect migrations to have run.
  if (process.env.NODE_ENV === 'development') {
    await sequelize.sync({ alter: false });
  }

  const [platformAdminUser, created] = await Usuario.findOrCreate({
    where: { email: platformAdminEmail },
    defaults: {
      nombre: platformAdminName,
      email: platformAdminEmail,
      password: rawPassword,
      tipo: 'platform_admin',
      activo: true,
      onboarding_completado: true,
      localId: null,
    },
  });

  // If user existed but is not platform_admin, don't silently change it.
  if (platformAdminUser.tipo !== 'platform_admin') {
    throw new Error(
      `User ${platformAdminEmail} exists but tipo='${platformAdminUser.tipo}'. Please change it to 'platform_admin' manually or pick another email.`
    );
  }

  // If the user already existed, allow updating name/password from env.
  // This keeps the process idempotent and makes PASSWORD rotation explicit.
  let updated = false;

  if (!created && platformAdminName && platformAdminUser.nombre !== platformAdminName) {
    platformAdminUser.nombre = platformAdminName;
    updated = true;
  }

  if (!created && providedPassword) {
    platformAdminUser.password = providedPassword;
    updated = true;
  }

  if (updated) {
    await platformAdminUser.save();
  }

  // Ensure referencia tenant exists and is linked to platform admin user.
  const [referenciaTenant] = await Tenant.findOrCreate({
    where: { adminUsuarioId: platformAdminUser.id },
    defaults: {
      nombre: referenciaTenantNombre,
      adminUsuarioId: platformAdminUser.id,
      referenciaTenantId: null,
      esReferencia: true,
      planDefault: referenciaPlanDefault,
      monedaDefault: referenciaMonedaDefault,
      suscripcionHasta: addDays(new Date(), referenciaSuscripcionDays),
      maxLocales: referenciaMaxLocales,
      activo: true,
      createdByPlatformAdminId: platformAdminUser.id,
    },
  });

  // Make sure it's marked as reference even if it existed.
  if (!referenciaTenant.esReferencia) {
    referenciaTenant.esReferencia = true;
    await referenciaTenant.save();
  }

  console.log('✅ Platform admin listo');
  console.log(`   Email: ${platformAdminEmail}`);
  console.log(`   Password: ${providedPassword ? '(provisto por env)' : rawPassword}`);
  console.log(`✅ Tenant referencia listo: ${referenciaTenant.id}`);
}

init()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('✗ init-platform-admin failed:', err.message || err);
    process.exit(1);
  });
