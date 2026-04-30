const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');

const { sequelize } = require('../config/database');

const MIGRATIONS_DIR = process.env.MIGRATIONS_DIR
  ? path.resolve(process.env.MIGRATIONS_DIR)
  : path.resolve(__dirname, '../../migrations');

const MIGRATIONS_TABLE = process.env.MIGRATIONS_TABLE || 'schema_migrations';

async function tableExists(tableName) {
  // Use to_regclass for a simple existence check in the current DB.
  // Default schema is typically "public".
  const [rows] = await sequelize.query('SELECT to_regclass($1) AS regclass;', {
    bind: [`public.${tableName}`]
  });
  return Boolean(rows && rows[0] && rows[0].regclass);
}

async function bootstrapSchemaIfNeeded() {
  // If the DB is empty (or missing core tables), bootstrap from Sequelize models.
  // This matches the schema that works locally (models + associations), then
  // the existing SQL/JS migrations can safely apply incremental changes.
  const hasUsuarios = await tableExists('usuarios');
  const hasLocales = await tableExists('locales');

  if (hasUsuarios && hasLocales) {
    return;
  }

  console.log('[migrations] Base tables missing; bootstrapping schema from Sequelize models (sequelize.sync)...');
  // UUID defaults for UUIDV4 on Postgres typically require uuid-ossp.
  await sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

  // Load models and associations.
  // eslint-disable-next-line global-require
  require('../models');

  // Create missing tables (does not drop; does not alter existing tables).
  await sequelize.sync();
  console.log('[migrations] Bootstrap completed (sequelize.sync)');
}

function isCandidate(filename) {
  return /^\d/.test(filename) && (filename.endsWith('.sql') || filename.endsWith('.js'));
}

function listMigrationFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter(isCandidate)
    .sort();
}

async function ensureMigrationsTable() {
  // Keep it simple and portable (no schema assumptions)
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function getAppliedSet() {
  try {
    const [rows] = await sequelize.query(`SELECT filename FROM ${MIGRATIONS_TABLE};`);
    return new Set((rows || []).map((r) => r.filename));
  } catch (err) {
    // Table might not exist yet
    return new Set();
  }
}

async function baselineExistingSchemaIfNeeded(applied, files) {
  const hasUsuarios = await tableExists('usuarios');
  const hasMesas = await tableExists('mesas');
  const hasComandas = await tableExists('comandas');
  if (!hasUsuarios || !hasMesas || !hasComandas) return applied;

  const baselineBefore = process.env.MIGRATION_BASELINE_BEFORE || '20260429000000';
  const baselineFiles = files.filter((filename) => filename < baselineBefore && !applied.has(filename));
  if (baselineFiles.length === 0) return applied;

  console.log(`[migrations] Existing schema detected; baselining ${baselineFiles.length} migration(s) before ${baselineBefore}`);
  for (const filename of baselineFiles) {
    await recordApplied(filename);
    applied.add(filename);
  }

  return applied;
}

function splitSqlStatements(sql) {
  // NOTE: This assumes migrations are simple DDL/DML without function bodies containing semicolons.
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function applySqlMigration(filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');
  const statements = splitSqlStatements(sql);

  await sequelize.transaction(async (t) => {
    for (const stmt of statements) {
      await sequelize.query(stmt, { transaction: t });
    }
  });
}

async function applyJsMigration(filePath) {
  // Sequelize migration-style files exporting { up, down }
  // We only run up.
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const migration = require(filePath);
  if (!migration || typeof migration.up !== 'function') {
    throw new Error(`Invalid JS migration (missing up): ${filePath}`);
  }

  const queryInterface = sequelize.getQueryInterface();
  await migration.up(queryInterface, Sequelize);
}

async function recordApplied(filename) {
  await sequelize.query(
    `INSERT INTO ${MIGRATIONS_TABLE} (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING;`,
    { bind: [filename] }
  );
}

async function run() {
  console.log(`[migrations] Dir: ${MIGRATIONS_DIR}`);
  console.log(`[migrations] Table: ${MIGRATIONS_TABLE}`);

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log('[migrations] No migrations directory found; skipping');
    return;
  }

  await bootstrapSchemaIfNeeded();
  await ensureMigrationsTable();
  const files = listMigrationFiles(MIGRATIONS_DIR);
  if (files.length === 0) {
    console.log('[migrations] No migration files found; skipping');
    return;
  }

  let applied = await getAppliedSet();
  applied = await baselineExistingSchemaIfNeeded(applied, files);

  let appliedCount = 0;

  for (const filename of files) {
    if (applied.has(filename)) {
      continue;
    }

    const fullPath = path.join(MIGRATIONS_DIR, filename);
    console.log(`[migrations] Applying ${filename}...`);

    if (filename.endsWith('.sql')) {
      await applySqlMigration(fullPath);
    } else if (filename.endsWith('.js')) {
      await applyJsMigration(fullPath);
    }

    await recordApplied(filename);
    appliedCount += 1;
    console.log(`[migrations] Applied ${filename}`);
  }

  console.log(`[migrations] Done. Newly applied: ${appliedCount}`);
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[migrations] FAILED:', err);
    process.exit(1);
  });
