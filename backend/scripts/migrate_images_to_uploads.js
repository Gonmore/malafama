#!/usr/bin/env node
const path = require('path');
const fs = require('fs');

// Load .env from backend folder
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const { sequelize } = require('../src/config/database');
const Usuario = require('../src/models/Usuario');
const Local = require('../src/models/Local');
const { saveBase64ToUploads } = require('../src/services/storage.service');

async function migrateUsers(batchSize = 50) {
  console.log('Migrating user photos to uploads...');
  let offset = 0;
  let total = 0;
  while (true) {
    const users = await Usuario.findAll({
      where: sequelize.where(sequelize.col('foto'), 'IS NOT', null),
      limit: batchSize,
      offset,
      order: [['created_at', 'ASC']]
    });
    if (!users || users.length === 0) break;

    for (const u of users) {
      try {
        const foto = u.foto;
        if (!foto) continue;
        // Skip if foto already looks like an URL or already has fotoUrl
        if ((u.fotoUrl && u.fotoUrl.length > 0) || /^https?:\/\//i.test(foto) || /^\/uploads\//.test(foto)) {
          continue;
        }
        if (/^data:/i.test(foto)) {
          const url = await saveBase64ToUploads(foto, 'user');
          u.fotoUrl = url;
          await u.save();
          total++;
          console.log(`User ${u.id} -> ${url}`);
        } else {
          // Not a data URI, try to skip
          console.log(`Skipping user ${u.id}: foto not data URI`);
        }
      } catch (err) {
        console.error('Error migrating user', u.id, err.message || err);
      }
    }

    offset += users.length;
  }
  console.log(`User photos migrated: ${total}`);
}

async function migrateLocals(batchSize = 50) {
  console.log('Migrating local logos to uploads...');
  let offset = 0;
  let total = 0;
  while (true) {
    const locals = await Local.findAll({
      where: sequelize.where(sequelize.col('logo'), 'IS NOT', null),
      limit: batchSize,
      offset,
      order: [['id', 'ASC']]
    });
    if (!locals || locals.length === 0) break;

    for (const l of locals) {
      try {
        const logo = l.logo;
        if (!logo) continue;
        if ((l.logoUrl && l.logoUrl.length > 0) || /^https?:\/\//i.test(logo) || /^\/uploads\//.test(logo)) {
          continue;
        }
        if (/^data:/i.test(logo)) {
          const url = await saveBase64ToUploads(logo, 'local');
          l.logoUrl = url;
          await l.save();
          total++;
          console.log(`Local ${l.id} -> ${url}`);
        } else {
          console.log(`Skipping local ${l.id}: logo not data URI`);
        }
      } catch (err) {
        console.error('Error migrating local', l.id, err.message || err);
      }
    }

    offset += locals.length;
  }
  console.log(`Local logos migrated: ${total}`);
}

async function run() {
  try {
    console.log('Starting migration script...');
    await sequelize.authenticate();
    console.log('DB connection OK');

    await migrateUsers();
    await migrateLocals();

    console.log('Migration finished.');
    process.exit(0);
  } catch (err) {
    console.error('Migration script failed:', err);
    process.exit(1);
  }
}

run();
