require('dotenv').config();

const { sequelize, testConnection } = require('../config/database');
require('../models');

async function main() {
  await testConnection();
  const { syncActiveEventOnce } = require('../services/firebaseSync.service');
  const result = await syncActiveEventOnce();

  if (!result) {
    console.log('[sync-firebase-once] No events synced (no active events found in Firestore)');
    return;
  }

  console.log('[sync-firebase-once] Synced:', {
    eventoId: result.evento.id,
    firestoreId: result.firestoreId,
    seatCount: result.seatCount
  });
}

main()
  .catch((err) => {
    console.error('[sync-firebase-once] FAILED:', err.message || err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close().catch(() => null);
  });
