// SISTEMA EMAIL ATTIVO — modificare qui (non in _deprecated/functions/, non più deployato)
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Init Firebase ────────────────────────────────────────────────────────────
const raw = process.env.FIREBASE_SA_KEY;
let serviceAccount;
try {
  serviceAccount = JSON.parse(raw);
} catch {
  const fixed = raw.replace(
    /("private_key"\s*:\s*")([\s\S]*?)(")/,
    (_, pre, key, post) => pre + key.replace(/\n/g, '\\n') + post
  );
  serviceAccount = JSON.parse(fixed);
}
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(value) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return String(value); }
}

function labelStatus(status) {
  const map = {
    'da-allestire':    'Da allestire',
    'in-allestimento': 'In allestimento',
    'pronto':          'Pronto',
    'ritirato':        'Ritirato',
  };
  return map[status] || status || '—';
}

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

function buildWeeklyReportHtml(noCoc, noPayment) {
  const templatePath = join(__dirname, '..', 'api', 'templates', 'weeklyReport.html');
  let html = readFileSync(templatePath, 'utf8');

  const dataGenerazione = new Date().toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return html
    .replace(/{{DATA_GENERAZIONE}}/g, dataGenerazione)
    .replace(/{{NUM_NO_COC}}/g,        String(noCoc.length))
    .replace(/{{NUM_NO_PAGAMENTO}}/g,   String(noPayment.length))
    .replace(/{{ROWS_NO_COC}}/g,       buildTableRows(noCoc))
    .replace(/{{ROWS_NO_PAGAMENTO}}/g,  buildTableRows(noPayment));
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const snap   = await db.collection('veicoli').get();
  const all    = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const active = all.filter(v => v.status !== 'ritirato');

  const noCoc     = active.filter(v => !v.cocMandato);
  const noPayment = active.filter(v => !v.pagamentoDocumenti);

  console.log(`[WeeklyReport] Veicoli attivi: ${active.length} | senza COC: ${noCoc.length} | senza pagamento: ${noPayment.length}`);

  if (noCoc.length === 0 && noPayment.length === 0) {
    console.log('[WeeklyReport] Nessuna pendenza. Email non inviata.');
    return;
  }

  // Destinatari
  const cfgSnap = await db.collection('config').doc('weeklyReport').get();
  if (!cfgSnap.exists || cfgSnap.data().enabled === false) {
    console.log('[WeeklyReport] Notifiche disabilitate. Email non inviata.');
    return;
  }
  const recipients = (cfgSnap.data().recipients || [])
    .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e).trim()));

  if (recipients.length === 0) {
    console.log('[WeeklyReport] Nessun destinatario configurato. Email non inviata.');
    return;
  }

  const transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls:    { rejectUnauthorized: false },
    connectionTimeout: 10000,
  });

  const subject = `SSV Manager – Report Settimanale COC & Pagamenti – ${new Date().toLocaleDateString('it-IT')}`;
  const html    = buildWeeklyReportHtml(noCoc, noPayment);

  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'SSV Manager <noreply@ssv-manager.it>',
        to:   recipients.join(', '),
        subject,
        html,
      });
      console.log(`[WeeklyReport] Email inviata (tentativo ${attempt}) a: ${recipients.join(', ')}`);
      await db.collection('emailLogs').add({
        eventType: 'weekly_report', noCocCount: noCoc.length,
        noPaymentCount: noPayment.length, recipients,
        success: true, error: null, sentAt: FieldValue.serverTimestamp(),
      });
      return;
    } catch (err) {
      lastError = err;
      console.warn(`[WeeklyReport] Tentativo ${attempt}/2 fallito:`, err.message);
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.error('[WeeklyReport] Impossibile inviare email:', lastError.message);
  await db.collection('emailLogs').add({
    eventType: 'weekly_report', noCocCount: noCoc.length,
    noPaymentCount: noPayment.length, recipients,
    success: false, error: lastError.message, sentAt: FieldValue.serverTimestamp(),
  });
  process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
