'use strict';

const nodemailer = require('nodemailer');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Formatta una data ISO o stringa YYYY-MM-DD in DD/MM/YYYY. */
function formatDate(value) {
  if (!value) return '—';
  try {
    if (value && typeof value.toDate === 'function') {
      value = value.toDate().toISOString().slice(0, 10);
    }
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return String(value);
  }
}

/** Converte boolean in Sì / No, string in se stessa, undefined in —. */
function fmt(value, type = 'text') {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'bool') return value === true || value === 'true' ? 'Sì' : 'No';
  if (type === 'date') return formatDate(value);
  return String(value);
}

/** Valida indirizzo email (regex base). */
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Etichetta stato veicolo leggibile. */
function labelStatus(status) {
  const map = {
    'da-allestire':    'Da allestire',
    'in-allestimento': 'In allestimento',
    'pronto':          'Pronto',
    'ritirato':        'Ritirato',
  };
  return map[status] || status || '—';
}

// ─────────────────────────────────────────────────────────────────────────────
// Configurazione SMTP
// ─────────────────────────────────────────────────────────────────────────────

function createTransporter() {
  const host   = process.env.SMTP_HOST;
  const port   = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';
  const user   = process.env.SMTP_USER;
  const pass   = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    const missing = [!host && 'SMTP_HOST', !user && 'SMTP_USER', !pass && 'SMTP_PASS'].filter(Boolean);
    throw new Error(`Configurazione SMTP incompleta. Variabili mancanti: ${missing.join(', ')}. ` +
      'Aggiungi i secret in GitHub → Settings → Secrets → Actions e lancia il workflow deploy-functions.');
  }

  console.log(`[EmailService] Connessione SMTP → ${host}:${port} (secure=${secure}, user=${user})`);

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }, // permette certificati self-signed (es. Exchange on-premise)
    connectionTimeout: 10000,
    greetingTimeout:   5000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Destinatari da Firestore
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Legge i destinatari dalla configurazione in Firestore.
 * @param {string} docName – nome del documento in collection 'config'
 */
async function getRecipients(docName = 'emailNotifications') {
  const db = getFirestore();
  const snap = await db.collection('config').doc(docName).get();

  if (!snap.exists) {
    console.warn(`[EmailService] Documento config/${docName} non trovato. Nessuna email inviata.`);
    return [];
  }

  const data = snap.data();

  if (data.enabled === false) {
    console.log(`[EmailService] Notifiche disabilitate in config/${docName}.`);
    return [];
  }

  const rawList = Array.isArray(data.recipients) ? data.recipients : [];
  const valid = rawList.filter(isValidEmail).map(e => e.trim());

  if (valid.length !== rawList.length) {
    console.warn(`[EmailService] ${rawList.length - valid.length} indirizzo/i non valido/i ignorato/i in ${docName}.`);
  }

  return valid;
}

// ─────────────────────────────────────────────────────────────────────────────
// Costruzione email HTML
// ─────────────────────────────────────────────────────────────────────────────

const TEMPLATE_PATH = path.join(__dirname, '../templates/vehicleReady.html');

/** Sostituisce tutti i placeholder {{KEY}} nel template con i valori del veicolo. */
function buildEmailHtml(vehicleId, vehicle) {
  let html = fs.readFileSync(TEMPLATE_PATH, 'utf8');

  const clienteAvvisatoTxt = vehicle.clienteAvvisatoSi
    ? `Sì${vehicle.clienteAvvisatoData ? ` (${formatDate(vehicle.clienteAvvisatoData)})` : ''}`
    : 'No';

  const inviatoIl = new Date().toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const placeholders = {
    COMMITTENTE:               fmt(vehicle.committente),
    NUMERO_TELAIO:             fmt(vehicle.numeroTelaio),
    ORDINE_SAP:                fmt(vehicle.ordineSAP),
    TIPO_ALLESTIMENTO:         fmt(vehicle.tipoAllestimento),
    DESCRIZIONE_ALLESTIMENTO:  fmt(vehicle.descrizioneAllestimento),
    CODICE_ALLESTIMENTO_SAP:   fmt(vehicle.codiceAllestimentoSAP),
    DESCRIZIONE_ALLESTIMENTO_SAP: fmt(vehicle.descrizioneAllestimentoSAP),
    NUMERO_MATRICOLA:          fmt(vehicle.numeroMatricola),
    NUMERO_MATRICOLA_LIDERKIT: fmt(vehicle.numeroMatricolaLiderkit),
    CODICE_INVENTARIO:         fmt(vehicle.codiceInventario),
    // Date
    DATA_ARRIVO:               fmt(vehicle.dataArrivo, 'date'),
    DATA_CONSEGNA:             fmt(vehicle.dataConsegna, 'date'),
    DATA_MONTAGGIO:            fmt(vehicle.dataMontaggio, 'date'),
    DATA_PREVISTA_MONTAGGIO:   fmt(vehicle.dataPrevistaMontaggio, 'date'),
    // Allestimento
    CODICE_ALLESTIMENTO:       fmt(vehicle.codiceAllestimento),
    CON_SPONDA_CARICATRICE:    fmt(vehicle.conSpondaCaricatrice, 'bool'),
    MARCA_SPONDA:              fmt(vehicle.marcaSponda),
    MATRICOLA_SPONDA:          fmt(vehicle.matricolaSponda),
    WEEK_SPEDIZIONE_KIT:       fmt(vehicle.weekSpedizioneKit),
    // Collaudo
    COLLAUDO:                  fmt(vehicle.collaudo),
    DATA_COLLAUDO:             fmt(vehicle.dataCollaudo, 'date'),
    OMOLOGAZIONE_COLLAUDO:     fmt(vehicle.omologazioneCollaudo),
    COC_FASE_1:                fmt(vehicle.cocFase1),
    // Ritiro
    MODALITA_RITIRO:           fmt(vehicle.modalitaRitiro),
    DATA_RITIRO:               fmt(vehicle.dataRitiro, 'date'),
    ORA_MONTAGGIO:             fmt(vehicle.oraMontaggio),
    TIPO_CONSEGNA:             fmt(vehicle.tipoConsegna),
    INDIRIZZO_CONSEGNA:        fmt(vehicle.indirizzoConsegna),
    CLIENTE_AVVISATO:          clienteAvvisatoTxt,
    RITIRO_GIORNO:             fmt(vehicle.ritiroGiorno),
    POSIZIONE_PARCHEGGIO:      fmt(vehicle.posizioneParcheggio),
    CHIAVI_DOPPIO_PARCHEGGIO:  fmt(vehicle.chiaviDoppioParcheggio),
    NOTE_RITIRO:               fmt(vehicle.noteRitiro),
    // Documenti
    PAGAMENTO_DOCUMENTI:       fmt(vehicle.pagamentoDocumenti),
    NOTE_PAGAMENTO:            fmt(vehicle.notePagamento),
    DOCUMENTI_MANDATI:         fmt(vehicle.documentiMandati, 'bool'),
    DATA_SPEDIZIONE_DOCUMENTI: fmt(vehicle.dataSpedizioneDocumenti, 'date'),
    // Note generali
    NOTE:                      fmt(vehicle.note),
    // Footer
    INVIATO_IL:                inviatoIl,
    VEHICLE_ID:                vehicleId,
  };

  for (const [key, value] of Object.entries(placeholders)) {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }

  return html;
}

// ─────────────────────────────────────────────────────────────────────────────
// Logging su Firestore
// ─────────────────────────────────────────────────────────────────────────────

async function logEmailResult(vehicleId, vehicle, recipients, success, errorMessage) {
  try {
    const db = getFirestore();
    await db.collection('emailLogs').add({
      eventType:   'vehicle_ready',
      vehicleId,
      committente: vehicle.committente || null,
      ordineSAP:   vehicle.ordineSAP   || null,
      recipients,
      success,
      error:       errorMessage || null,
      sentAt:      FieldValue.serverTimestamp(),
    });
  } catch (logErr) {
    // Il logging non deve mai bloccare il flusso principale
    console.error('[EmailService] Errore durante il logging su Firestore:', logErr.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point principale
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Invia la notifica email "veicolo pronto" per una singola transizione.
 * Chiamato dalla Cloud Function dopo la verifica della transizione di stato.
 *
 * @param {string} vehicleId  – ID documento Firestore del veicolo
 * @param {object} vehicle    – Dati completi del veicolo (snapshot after)
 */
async function sendVehicleReadyEmail(vehicleId, vehicle) {
  const recipients = await getRecipients();

  if (recipients.length === 0) {
    console.log(`[EmailService] Nessun destinatario configurato. Email non inviata per veicolo ${vehicleId}.`);
    return;
  }

  const subject = `Veicolo pronto – ${vehicle.ordineSAP || vehicle.numeroTelaio || vehicleId} – ${vehicle.committente || ''}`.trim();
  const html    = buildEmailHtml(vehicleId, vehicle);

  let lastError = null;
  const MAX_RETRIES = 2;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const transporter = createTransporter();
      await transporter.sendMail({
        from:    process.env.SMTP_FROM || 'SSV Manager <noreply@ssv-manager.it>',
        to:      recipients.join(', '),
        subject,
        html,
      });

      console.log(`[EmailService] Email inviata (tentativo ${attempt}) per veicolo ${vehicleId} a: ${recipients.join(', ')}`);
      await logEmailResult(vehicleId, vehicle, recipients, true, null);
      return; // successo → esci
    } catch (err) {
      lastError = err;
      console.warn(`[EmailService] Tentativo ${attempt}/${MAX_RETRIES} fallito:`, err.message);

      if (attempt < MAX_RETRIES) {
        // Attesa esponenziale: 2s, poi 4s
        await new Promise(r => setTimeout(r, attempt * 2000));
      }
    }
  }

  // Tutti i tentativi falliti
  console.error(`[EmailService] Impossibile inviare email per veicolo ${vehicleId} dopo ${MAX_RETRIES} tentativi:`, lastError.message);
  await logEmailResult(vehicleId, vehicle, recipients, false, lastError.message);
}

// ─────────────────────────────────────────────────────────────────────────────
// Report settimanale COC / Pagamenti
// ─────────────────────────────────────────────────────────────────────────────

const WEEKLY_TEMPLATE_PATH = path.join(__dirname, '../templates/weeklyReport.html');

/** Costruisce le righe <tr> per la tabella del report. */
function buildTableRows(vehicles) {
  if (vehicles.length === 0) {
    return '<tr class="empty-row"><td colspan="6">Nessun veicolo in questa categoria ✓</td></tr>';
  }
  return vehicles.map(v => {
    const status = labelStatus(v.status);
    const statusClass = v.status === 'pronto' ? 'badge-green'
      : v.status === 'ritirato' ? 'badge-gray'
      : 'badge-red';
    return `
      <tr>
        <td><strong>${v.committente || '—'}</strong></td>
        <td class="col-hide">${v.numeroTelaio || '—'}</td>
        <td>${v.ordineSAP || '—'}</td>
        <td>${v.tipoAllestimento || '—'}</td>
        <td><span class="badge ${statusClass}">${status}</span></td>
        <td>${formatDate(v.dataConsegna)}</td>
      </tr>`;
  }).join('');
}

/** Costruisce l'email HTML del report settimanale. */
function buildWeeklyReportHtml(noCoc, noPayment) {
  let html = fs.readFileSync(WEEKLY_TEMPLATE_PATH, 'utf8');

  const dataGenerazione = new Date().toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  html = html
    .replace(/{{DATA_GENERAZIONE}}/g, dataGenerazione)
    .replace(/{{NUM_NO_COC}}/g,       String(noCoc.length))
    .replace(/{{NUM_NO_PAGAMENTO}}/g,  String(noPayment.length))
    .replace(/{{ROWS_NO_COC}}/g,      buildTableRows(noCoc))
    .replace(/{{ROWS_NO_PAGAMENTO}}/g, buildTableRows(noPayment));

  return html;
}

/**
 * Invia il report settimanale COC / Pagamenti a tutti i destinatari
 * configurati in config/weeklyReport.
 * Chiamato dalla Cloud Function schedulata (ogni lunedì).
 */
async function sendWeeklyReport() {
  const db = getFirestore();

  // ── Leggi tutti i veicoli non ritirati ──────────────────────────────────
  const snap = await db.collection('veicoli').get();
  const all  = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const active = all.filter(v => v.status !== 'ritirato');

  // ── Applica i filtri ─────────────────────────────────────────────────────
  const noCoc     = active.filter(v => !v.cocMandato);
  const noPayment = active.filter(v => !v.pagamentoDocumenti);

  console.log(`[WeeklyReport] Veicoli attivi: ${active.length} | senza COC: ${noCoc.length} | senza pagamento: ${noPayment.length}`);

  if (noCoc.length === 0 && noPayment.length === 0) {
    console.log('[WeeklyReport] Nessuna pendenza. Email non inviata.');
    return;
  }

  // ── Destinatari ──────────────────────────────────────────────────────────
  const recipients = await getRecipients('weeklyReport');
  if (recipients.length === 0) {
    console.log('[WeeklyReport] Nessun destinatario configurato. Email non inviata.');
    return;
  }

  const subject = `SSV Manager – Report Settimanale COC & Pagamenti – ${new Date().toLocaleDateString('it-IT')}`;
  const html    = buildWeeklyReportHtml(noCoc, noPayment);

  let lastError = null;
  const MAX_RETRIES = 2;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const transporter = createTransporter();
      await transporter.sendMail({
        from:    process.env.SMTP_FROM || 'SSV Manager <noreply@ssv-manager.it>',
        to:      recipients.join(', '),
        subject,
        html,
      });

      console.log(`[WeeklyReport] Email inviata (tentativo ${attempt}) a: ${recipients.join(', ')}`);

      // Log su Firestore
      await db.collection('emailLogs').add({
        eventType:      'weekly_report',
        noCocCount:     noCoc.length,
        noPaymentCount: noPayment.length,
        recipients,
        success:        true,
        error:          null,
        sentAt:         FieldValue.serverTimestamp(),
      });
      return;
    } catch (err) {
      lastError = err;
      console.warn(`[WeeklyReport] Tentativo ${attempt}/${MAX_RETRIES} fallito:`, err.message);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, attempt * 2000));
      }
    }
  }

  console.error('[WeeklyReport] Impossibile inviare email dopo tutti i tentativi:', lastError.message);
  await db.collection('emailLogs').add({
    eventType:      'weekly_report',
    noCocCount:     noCoc.length,
    noPaymentCount: noPayment.length,
    recipients,
    success:        false,
    error:          lastError.message,
    sentAt:         FieldValue.serverTimestamp(),
  });
}

module.exports = { sendVehicleReadyEmail, sendWeeklyReport };
