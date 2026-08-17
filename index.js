'use strict';

const { onDocumentUpdated }  = require('firebase-functions/v2/firestore');
const { onSchedule }         = require('firebase-functions/v2/scheduler');
const { initializeApp }      = require('firebase-admin/app');
const { sendVehicleReadyEmail, sendWeeklyReport } = require('./services/emailService');

// Inizializzazione Firebase Admin (una sola volta per processo)
initializeApp();

/**
 * notifyVehicleReady
 * ──────────────────
 * Trigger: aggiornamento documento nella collezione `veicoli`
 * Condizione: transizione esatta  in-allestimento → pronto
 *
 * La funzione è idempotente per design:
 *   • Se lo stato non cambia (salvataggio senza modifica) → nessuna email
 *   • Se il cambio non è la transizione esatta → nessuna email
 *   • Il trigger Firestore si attiva una volta per write → nessuna duplicazione
 */
exports.notifyVehicleReady = onDocumentUpdated(
  {
    document: 'veicoli/{vehicleId}',
    region:   'europe-west1',   // Adatta alla region del tuo progetto Firebase
  },
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();

    // ── Verifica transizione esatta ──────────────────────────────────────────
    if (before.status !== 'in-allestimento' || after.status !== 'pronto') {
      return null; // transizione non interessante → exit silenzioso
    }

    const vehicleId = event.params.vehicleId;
    console.log(`[notifyVehicleReady] Transizione rilevata per veicolo ${vehicleId}: in-allestimento → pronto`);

    try {
      await sendVehicleReadyEmail(vehicleId, after);
    } catch (err) {
      // Errori già loggati in emailService. Non rilanciamo per evitare
      // retry automatici da Firebase (l'email potrebbe già essere stata
      // parzialmente inviata).
      console.error(`[notifyVehicleReady] Errore finale per veicolo ${vehicleId}:`, err.message);
    }

    return null;
  }
);

/**
 * weeklyReportCOC
 * ───────────────
 * Scheduled: ogni lunedì alle 08:00 (Europe/Rome)
 * Invia il report settimanale con i veicoli privi di:
 *   • COC Fase 1 ricevuto (cocMandato !== true)
 *   • Pagamento documenti ricevuto (pagamentoDocumenti !== true)
 *
 * Destinatari configurabili dalla UI admin in: config/weeklyReport
 */
exports.weeklyReportCOC = onSchedule(
  {
    schedule:  '0 8 * * 1',          // ogni lunedì alle 08:00
    timeZone:  'Europe/Rome',
    region:    'europe-west1',
    memory:    '256MiB',
    timeoutSeconds: 120,
  },
  async () => {
    console.log('[weeklyReportCOC] Avvio report settimanale...');
    try {
      await sendWeeklyReport();
    } catch (err) {
      console.error('[weeklyReportCOC] Errore fatale:', err.message);
    }
  }
);
