/**
 * Firebase Firestore → PostgreSQL sync service.
 *
 * Reads seat state from the external reservations system (colección eventos_v3)
 * and keeps the local AsientoEvento table in sync in near-real-time.
 *
 * Requires env vars:
 *   FIREBASE_SERVICE_ACCOUNT_JSON   – stringified service-account JSON
 *   FIREBASE_SERVICE_ACCOUNT_BASE64 – base64-encoded service-account JSON
 *   FIREBASE_SERVICE_ACCOUNT_PATH   – path to service-account file
 *   or GOOGLE_APPLICATION_CREDENTIALS – path to service-account file
 *   FIRESTORE_COLLECTION           – Firestore collection name (default: eventos_v3)
 *
 * If credentials are missing the service starts in no-op mode so the rest of
 * the app works without Firebase.
 */

const { Op } = require('sequelize');
const fs = require('fs');

let admin = null;
let db = null;
let activeListener = null; // Firestore document-level listener (seat changes on primary event)
let collectionListener = null; // Firestore collection-level listener (new/deleted events)
let activeFirestoreId = null;
let activeEventoId = null;
let refreshTimer = null;
let refreshInFlight = null;

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the start-of-day date that marks the beginning of the "active window".
 * A show is active until 3 AM of the day after its date.
 * So if it's currently 1 AM on the 14th, the active cutoff is midnight the 13th.
 */
function getActiveCutoffDate() {
  const now = new Date();
  const d = new Date(now);
  if (d.getHours() < 3) {
    d.setDate(d.getDate() - 1);
  }
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseSeatId(seatId) {
  const [mesaRaw, letraRaw = ''] = String(seatId || '').split('-');
  return { mesaNum: parseInt(mesaRaw, 10), letra: letraRaw.toUpperCase() };
}

function parseFirestoreDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value.seconds) return new Date(value.seconds * 1000);
  return null;
}

function getEventDate(data) {
  return parseFirestoreDate(data?.metadata?.fecha || data?.fecha || data?.date);
}

function getEventTitle(firestoreId, data) {
  return data?.metadata?.titulo || data?.titulo || data?.nombre || firestoreId;
}

function getFirestoreEstado(data) {
  return String(data?.metadata?.estado || data?.estado || '').toLowerCase().trim();
}

function isDeletedLikeEstado(estado) {
  return ['eliminado', 'borrado', 'deleted', 'inactivo', 'cancelado'].includes(estado);
}

function isFirestoreMissingIndexError(err) {
  const msg = String((err && (err.message || err.details)) || '').toLowerCase();
  return msg.includes('requires an index') || msg.includes('create_composite=');
}

function getFirebaseSyncRefreshMs() {
  const raw = Number(process.env.FIREBASE_SYNC_REFRESH_MS || 60000);
  return Number.isFinite(raw) && raw >= 5000 ? raw : 60000;
}

function getFirebaseReconcileMaxLocal() {
  const raw = Number(process.env.FIREBASE_RECONCILE_MAX_LOCAL || 200);
  return Number.isFinite(raw) && raw >= 20 ? raw : 200;
}

// ── Firebase init ─────────────────────────────────────────────────────────────

function initFirebase() {
  try {
    admin = require('firebase-admin');
    const credJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const credBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
    const credPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;

    let credentialConfig = null;
    if (credJson) {
      credentialConfig = admin.credential.cert(JSON.parse(credJson));
      console.log('[Firebase] Using FIREBASE_SERVICE_ACCOUNT_JSON');
    } else if (credBase64) {
      const decoded = Buffer.from(credBase64, 'base64').toString('utf8');
      credentialConfig = admin.credential.cert(JSON.parse(decoded));
      console.log('[Firebase] Using FIREBASE_SERVICE_ACCOUNT_BASE64');
    } else if (credPath) {
      if (fs.existsSync(credPath) && fs.statSync(credPath).isFile()) {
        credentialConfig = admin.credential.cert(require(credPath));
        console.log(`[Firebase] Using service account file: ${credPath}`);
      } else {
        credentialConfig = admin.credential.applicationDefault();
        console.log(`[Firebase] Using application default credentials path: ${credPath}`);
      }
    } else {
      console.warn('[Firebase] Missing credentials (FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_SERVICE_ACCOUNT_BASE64, FIREBASE_SERVICE_ACCOUNT_PATH or GOOGLE_APPLICATION_CREDENTIALS) - sync disabled');
      admin = null;
      return false;
    }

    if (!admin.apps.length) {
      admin.initializeApp({ credential: credentialConfig });
    }
    db = admin.firestore();
    console.log('[Firebase] Initialized OK');
    return true;
  } catch (err) {
    console.warn('[Firebase] Init failed:', err.message || err);
    admin = null;
    return false;
  }
}

// ── active event query ────────────────────────────────────────────────────────

/**
 * Finds up to maxResults upcoming events in Firestore (after the active cutoff), sorted by date asc.
 * Returns an array of { firestoreId, doc, data, fecha }.
 */
async function findUpcomingFirestoreEvents(maxResults = 4) {
  if (!db) return [];
  const collection = process.env.FIRESTORE_COLLECTION || 'eventos_v3';
  const cutoff = getActiveCutoffDate();
  const candidates = [];
  const seenIds = new Set();

  function addCandidate(doc) {
    if (seenIds.has(doc.id)) return;
    const data = doc.data();
    const fecha = getEventDate(data);
    if (!fecha) return;
    fecha.setHours(0, 0, 0, 0);
    if (fecha >= cutoff) {
      candidates.push({ firestoreId: doc.id, doc, data, fecha });
      seenIds.add(doc.id);
    }
  }

  try {
    let snap = null;
    try {
      snap = await db.collection(collection)
        .where('metadata.estado', '==', 'activo')
        .orderBy('metadata.fecha', 'asc')
        .limit(maxResults + 2)
        .get();
    } catch (err) {
      if (isFirestoreMissingIndexError(err)) {
        console.warn('[Firebase] Missing index for active-event query, using fallback query path');
      } else {
        throw err;
      }
    }

    if (snap) snap.docs.forEach(addCandidate);

    // Fallback: if filtered query didn't yield enough, fetch unfiltered docs and filter by date.
    // Order descending so the most recent (and future) events come first.
    if (candidates.length < maxResults) {
      let allSnap;
      try {
        // desc → newest events first; single-field index auto-created by Firestore
        allSnap = await db.collection(collection)
          .orderBy('metadata.fecha', 'desc')
          .limit(50)
          .get();
      } catch (_) {
        try {
          allSnap = await db.collection(collection)
            .orderBy('fecha', 'desc')
            .limit(50)
            .get();
        } catch (__) {
          // Last resort: unordered — use a large limit so we don't miss future events buried
          // among many old events in the collection.
          allSnap = await db.collection(collection)
            .limit(100)
            .get();
        }
      }
      console.log(`[Firebase] Fallback fetched ${allSnap.docs.length} doc(s) from collection "${collection}"`);
      allSnap.docs.forEach(addCandidate);
    }

    candidates.sort((a, b) => a.fecha - b.fecha);

    if (candidates.length === 0) {
      // ── diagnostic: show why every doc was skipped ─────────────────────────
      console.warn('[Firebase] No candidates found. Diagnosing all fetched docs:');
      console.warn(`  cutoff = ${cutoff.toISOString()}`);
      const diagSnap = await db.collection(collection).limit(20).get().catch(() => null);
      if (!diagSnap || diagSnap.empty) {
        console.warn('  [Firebase] Collection is empty or unreachable');
      } else {
        for (const doc of diagSnap.docs) {
          const d = doc.data();
          const rawFecha = d?.metadata?.fecha ?? d?.fecha ?? d?.date ?? null;
          let parsedStr = '(no date field found)';
          if (rawFecha !== null && rawFecha !== undefined) {
            let parsed = null;
            if (rawFecha && typeof rawFecha.toDate === 'function') parsed = rawFecha.toDate();
            else if (typeof rawFecha === 'string' || typeof rawFecha === 'number') parsed = new Date(rawFecha);
            else if (rawFecha && rawFecha.seconds) parsed = new Date(rawFecha.seconds * 1000);
            if (!parsed || Number.isNaN(parsed.getTime())) {
              parsedStr = `(could not parse: type=${typeof rawFecha}, value=${JSON.stringify(rawFecha).slice(0, 80)})`;
            } else {
              const copy = new Date(parsed);
              copy.setHours(0, 0, 0, 0);
              parsedStr = copy >= cutoff
                ? `OK  ${copy.toISOString()} >= cutoff`
                : `OLD ${copy.toISOString()} < cutoff`;
            }
          }
          console.warn(`  doc=${doc.id}  estado="${d?.metadata?.estado ?? d?.estado}"  fecha: ${parsedStr}`);
        }
      }
      // ──────────────────────────────────────────────────────────────────────
    }

    return candidates.slice(0, maxResults);
  } catch (err) {
    console.error('[Firebase] findUpcomingFirestoreEvents error:', err.message || err);
    return [];
  }
}

/**
 * Finds the next upcoming event in Firestore (next show after the active cutoff).
 * Returns { firestoreId, doc } or null.
 */
async function findActiveFirestoreEvent() {
  const results = await findUpcomingFirestoreEvents(1);
  return results[0] || null;
}

// ── upsert helpers ────────────────────────────────────────────────────────────

async function upsertEvento(firestoreId, data, fecha) {
  const { EventoComanda } = require('../models');
  const metadata = data.metadata || {};
  const [evento] = await EventoComanda.upsert({
    firestoreId,
    titulo: getEventTitle(firestoreId, data),
    fecha: fecha.toISOString().split('T')[0],
    horaApertura: metadata.horaApertura || data.horaApertura || null,
    horaInicio: metadata.horaInicio || data.horaInicio || data.hora || null,
    estado: 'activo',
    metadata: { titulo: metadata.titulo, logoUrl: metadata.logoUrl, resumen: data.resumen, sectores: data.sectores }
  }, { returning: true });
  return evento;
}

async function upsertSeats(eventoId, asientos) {
  const { AsientoEvento } = require('../models');
  if (!asientos || typeof asientos !== 'object') return;

  const rows = Object.entries(asientos).map(([seatId, seatData]) => {
    const { mesaNum, letra } = parseSeatId(seatId);
    return {
      seatId,
      mesaNum,
      letra,
      estado: seatData.estado || 'disponible',
      eventoId,
      codigoTicket: seatData.codigoTicket || null,
      tipoOcupacion: seatData.tipoOcupacion || null,
      precioVendido: seatData.precioVendido != null ? seatData.precioVendido : null
    };
  });

  // Batch upsert in chunks of 100
  const chunkSize = 100;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await AsientoEvento.bulkCreate(chunk, {
      updateOnDuplicate: ['estado', 'codigo_ticket', 'tipo_ocupacion', 'precio_vendido', 'updated_at']
    });
  }
  console.log(`[Firebase] Synced ${rows.length} seats for event ${eventoId}`);
}

async function deleteLocalEventByFirestoreId(firestoreId, io = null) {
  const { sequelize } = require('../config/database');
  const {
    EventoComanda,
    AsientoEvento,
    TurnoMesero,
    AsignacionMesaEvento,
    AlertaMesero
  } = require('../models');

  const evento = await EventoComanda.findOne({ where: { firestoreId } });
  if (!evento) return null;

  const eventoId = evento.id;

  await sequelize.transaction(async (t) => {
    await AsientoEvento.destroy({ where: { eventoId }, transaction: t });
    await AsignacionMesaEvento.destroy({ where: { eventoId }, transaction: t });
    await TurnoMesero.destroy({ where: { eventoId }, transaction: t });
    await AlertaMesero.destroy({ where: { eventoId }, transaction: t });
    await EventoComanda.destroy({ where: { id: eventoId }, transaction: t });
  });

  console.log(`[Firebase] Local event deleted after Firestore removal: ${firestoreId}`);
  if (io) {
    io.emit('evento:deleted', { eventoId, firestoreId });
  }

  return { eventoId, firestoreId };
}

async function cleanupDeletedFirestoreEvents(io = null) {
  if (!db) {
    const ok = initFirebase();
    if (!ok) return 0;
  }

  const { EventoComanda } = require('../models');

  const localEvents = await EventoComanda.findAll({
    attributes: ['firestoreId'],
    where: {
      firestoreId: {
        [Op.ne]: null
      }
    },
    order: [['updated_at', 'DESC']],
    limit: getFirebaseReconcileMaxLocal()
  });

  const firestoreIds = localEvents
    .map((e) => e.firestoreId)
    .filter((id) => typeof id === 'string' && id.trim());

  if (!firestoreIds.length) return 0;

  const collection = process.env.FIRESTORE_COLLECTION || 'eventos_v3';
  const missingIds = [];
  const chunkSize = 100;

  for (let i = 0; i < firestoreIds.length; i += chunkSize) {
    const chunk = firestoreIds.slice(i, i + chunkSize);
    const refs = chunk.map((id) => db.collection(collection).doc(id));
    const snaps = await db.getAll(...refs);

    for (let j = 0; j < snaps.length; j += 1) {
      if (!snaps[j].exists) {
        missingIds.push(chunk[j]);
        continue;
      }

      const data = snaps[j].data();
      const estado = getFirestoreEstado(data);
      if (isDeletedLikeEstado(estado)) {
        missingIds.push(chunk[j]);
      }
    }
  }

  if (!missingIds.length) return 0;

  for (const firestoreId of missingIds) {
    await deleteLocalEventByFirestoreId(firestoreId, io);
  }

  console.log(`[Firebase] Reconciled local DB: removed ${missingIds.length} deleted Firestore event(s)`);
  return missingIds.length;
}

async function syncActiveEventOnce(io = null) {
  if (!db) {
    const ok = initFirebase();
    if (!ok) return null;
  }

  const results = await findUpcomingFirestoreEvents(4);
  if (!results.length) {
    console.log('[Firebase] No active events found in Firestore');
    return null;
  }

  let primaryResult = null;
  for (const { firestoreId, data, fecha } of results) {
    console.log(`[Firebase] Syncing event: ${firestoreId} (${getEventTitle(firestoreId, data)})`);
    const evento = await upsertEvento(firestoreId, data, fecha);
    await upsertSeats(evento.id, data.asientos);
    if (!primaryResult) {
      primaryResult = { evento, firestoreId, seatCount: data?.asientos ? Object.keys(data.asientos).length : 0 };
    }
    if (io) io.emit('evento:sync', { eventoId: evento.id, firestoreId });
  }

  return primaryResult;
}

// ── snapshot listener ─────────────────────────────────────────────────────────

function startListener(firestoreId, eventoId, io) {
  if (!db) return;
  const collection = process.env.FIRESTORE_COLLECTION || 'eventos_v3';

  if (activeListener) {
    activeListener(); // unsubscribe previous
    activeListener = null;
  }

  activeListener = db.collection(collection).doc(firestoreId).onSnapshot(
    async (snap) => {
      if (!snap.exists) {
        await deleteLocalEventByFirestoreId(firestoreId, io);
        if (activeListener) {
          activeListener();
          activeListener = null;
        }
        activeFirestoreId = null;
        activeEventoId = null;
        return;
      }
      const data = snap.data();
      const asientos = data?.asientos;
      if (!asientos) return;

      const { AsientoEvento } = require('../models');

      for (const [seatId, seatData] of Object.entries(asientos)) {
        const { mesaNum, letra } = parseSeatId(seatId);
        const nuevoEstado = seatData.estado || 'disponible';

        const existing = await AsientoEvento.findOne({ where: { seatId, eventoId } });
        if (existing && existing.estado === nuevoEstado) continue; // no change

        await AsientoEvento.upsert({
          seatId,
          mesaNum,
          letra,
          estado: nuevoEstado,
          eventoId,
          codigoTicket: seatData.codigoTicket || null,
          tipoOcupacion: seatData.tipoOcupacion || null,
          precioVendido: seatData.precioVendido != null ? seatData.precioVendido : null
        });

        if (io) {
          io.emit('asiento:update', { eventoId, seatId, mesaNum, letra, estado: nuevoEstado });
        }
      }
    },
    (err) => {
      console.error('[Firebase] onSnapshot error:', err.message || err);
    }
  );

  activeFirestoreId = firestoreId;
  activeEventoId = eventoId;

  console.log(`[Firebase] Listening for seat changes on doc: ${firestoreId}`);
}

/**
 * Collection-level listener: fires immediately when any event document is added or removed
 * from Firestore, without waiting for the 60-second periodic refresh.
 * Seat changes (modified) are handled by the document-level listener (startListener).
 */
function startCollectionListener(io) {
  if (!db) return;
  if (collectionListener) {
    collectionListener();
    collectionListener = null;
  }

  const collection = process.env.FIRESTORE_COLLECTION || 'eventos_v3';
  let isInitialSnapshot = true;

  collectionListener = db.collection(collection).onSnapshot(
    async (snap) => {
      // Skip the initial snapshot — already handled by refreshActiveEventSync on startup
      if (isInitialSnapshot) {
        isInitialSnapshot = false;
        return;
      }

      let shouldRefresh = false;

      for (const { doc, type } of snap.docChanges()) {
        if (type === 'added') {
          console.log(`[Firebase] New event detected in Firestore: ${doc.id}`);
          shouldRefresh = true;
        } else if (type === 'removed') {
          console.log(`[Firebase] Event removed from Firestore: ${doc.id}`);
          await deleteLocalEventByFirestoreId(doc.id, io).catch((err) =>
            console.error('[Firebase] Error deleting local event on removal:', err.message || err)
          );
          if (doc.id === activeFirestoreId) shouldRefresh = true;
        }
        // 'modified' → seat changes, handled by startListener on the primary event document
      }

      if (shouldRefresh) {
        refreshActiveEventSync(io, { emitSyncEvent: true }).catch((err) =>
          console.error('[Firebase] Collection-triggered sync error:', err.message || err)
        );
      }
    },
    (err) => {
      console.error('[Firebase] Collection listener error:', err.message || err);
      collectionListener = null;
      // Auto-restart after error
      setTimeout(() => startCollectionListener(io), 10000);
    }
  );

  console.log(`[Firebase] Real-time collection listener active on: ${collection}`);
}

async function refreshActiveEventSync(io, { emitSyncEvent = false } = {}) {
  if (!db) {
    const ok = initFirebase();
    if (!ok) return null;
  }

  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      await cleanupDeletedFirestoreEvents(io);
    } catch (err) {
      console.error('[Firebase] Reconcile deleted-events error:', err.message || err);
    }

    const results = await findUpcomingFirestoreEvents(4);

    if (!results.length) {
      // Only stop the document-level seat listener — keep the collection listener running
      // so a new event created in Firestore is detected immediately.
      if (activeListener) {
        activeListener();
        activeListener = null;
        activeFirestoreId = null;
        activeEventoId = null;
        console.log('[Firebase] No active Firestore event; seat listener detached, collection listener still watching');
      } else {
        console.log('[Firebase] No active event found in Firestore');
      }
      return null;
    }

    // Sync all upcoming events to local DB; the real-time listener stays on the most imminent one.
    let primaryEntry = null;
    for (const entry of results) {
      const evento = await upsertEvento(entry.firestoreId, entry.data, entry.fecha);
      await upsertSeats(evento.id, entry.data.asientos);
      if (!primaryEntry) primaryEntry = { evento, firestoreId: entry.firestoreId, data: entry.data };
    }

    const { evento, firestoreId, data } = primaryEntry;
    const shouldRebindListener = activeFirestoreId !== firestoreId || activeEventoId !== evento.id || !activeListener;
    if (shouldRebindListener) {
      console.log(`[Firebase] Active event found: ${firestoreId} (${getEventTitle(firestoreId, data)}) + ${results.length - 1} more upcoming`);
      startListener(firestoreId, evento.id, io);
      emitSyncEvent = true;
    }

    if (emitSyncEvent && io) {
      io.emit('evento:sync', { eventoId: evento.id, firestoreId });
    }

    return { evento, firestoreId, seatCount: data?.asientos ? Object.keys(data.asientos).length : 0 };
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

// ── public API ────────────────────────────────────────────────────────────────

/**
 * Called once on server startup.
 * 1. Finds active event in Firestore
 * 2. Upserts it and all its seats to PostgreSQL
 * 3. Starts live listener
 */
async function startFirebaseSync(io) {
  try {
    if (refreshTimer) return;

    // Initial sync: load up to 4 upcoming events and start the document-level seat listener
    await refreshActiveEventSync(io, { emitSyncEvent: true });

    // Real-time collection listener: instantly detects new or deleted events
    startCollectionListener(io);

    // Periodic refresh as safety net (reconnects if listener drops, catches edge cases)
    refreshTimer = setInterval(() => {
      refreshActiveEventSync(io).catch((err) => {
        console.error('[Firebase] Periodic sync error:', err.message || err);
      });
    }, getFirebaseSyncRefreshMs());

    if (typeof refreshTimer.unref === 'function') {
      refreshTimer.unref();
    }

    console.log(`[Firebase] Background refresh enabled every ${getFirebaseSyncRefreshMs()}ms`);
  } catch (err) {
    console.error('[Firebase] startFirebaseSync error:', err.message || err);
  }
}

function stopFirebaseSync(options = {}) {
  const { keepTimer = false } = options;

  if (!keepTimer && refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  if (collectionListener) {
    collectionListener();
    collectionListener = null;
    console.log('[Firebase] Collection listener stopped');
  }

  if (activeListener) {
    activeListener();
    activeListener = null;
    console.log('[Firebase] Document listener stopped');
  }

  activeFirestoreId = null;
  activeEventoId = null;
}

module.exports = {
  startFirebaseSync,
  stopFirebaseSync,
  refreshActiveEventSync,
  getActiveCutoffDate,
  parseSeatId,
  upsertSeats,
  deleteLocalEventByFirestoreId,
  cleanupDeletedFirestoreEvents,
  findActiveFirestoreEvent,
  findUpcomingFirestoreEvents,
  syncActiveEventOnce
};
