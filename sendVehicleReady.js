// SISTEMA EMAIL ATTIVO — modificare qui (non in _deprecated/functions/, non più deployato)
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import nodemailer from 'nodemailer';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function initFirebase() {
  if (getApps().length) return;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT non impostata in Vercel');

  let sa;
  try {
    sa = JSON.parse(raw);
  } catch {
    // Vercel converte \n in newlines reali dentro i valori delle env var.
    // Il private_key del service account ha newlines reali → JSON non valido.
    // Soluzione: escaped le newlines dentro il valore del private_key.
    try {
      const fixed = raw.replace(
        /("private_key"\s*:\s*")([\s\S]*?)(")/,
        (_, pre, key, post) => pre + key.replace(/\n/g, '\\n') + post
      );
      sa = JSON.parse(fixed);
    } catch (err2) {
      throw new Error(`FIREBASE_SERVICE_ACCOUNT non valido: ${err2.message}`);
    }
  }
  initializeApp({ credential: cert(sa) });
}

function formatDate(value) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return String(value); }
}

function fmt(value, type = 'text') {
  if (value === null || value === undefined || value === '') return '—';
  if (type === 'bool') return value === true || value === 'true' ? 'Sì' : 'No';
  if (type === 'date') return formatDate(value);
  return String(value);
}

function labelStatus(status) {
  const map = {
    'da-allestire':    'Da allestire',
    'in-allestimento': 'In allestimento',
    'pronto':          'Pronto',
    'ritirato':        'Ritirato',
  };
  return map[status] || fmt(status);
}

function labelStatoRitiro(status) {
  const map = {
    'da-pianificare': 'Da pianificare',
    'pianificato':    'Pianificato',
    'svolto':         'Svolto',
  };
  return map[status] || fmt(status);
}

function buildFilesHtml(distinta, files) {
  const items = [];
  if (distinta?.name) {
    items.push({ name: distinta.name, url: distinta.downloadURL, tag: 'Distinta' });
  }
  if (Array.isArray(files)) {
    for (const f of files) {
      if (f?.name) items.push({ name: f.name, url: f.downloadURL, tag: null });
    }
  }
  if (items.length === 0) return 'Nessun allegato';
  return items.map(it => {
    const label = it.tag ? `${it.tag}: ${it.name}` : it.name;
    return it.url
      ? `<div style="margin-bottom:4px;"><a href="${it.url}" style="color:#b91c1c; text-decoration:underline;">${label}</a></div>`
      : `<div style="margin-bottom:4px;">${label}</div>`;
  }).join('');
}

function buildEmailHtml(vehicleId, vehicle) {
  // Prima prova il path relativo all'API (con vercel.json includeFiles)
  // Poi prova process.cwd() come fallback
  let templatePath;
  try {
    templatePath = join(__dirname, 'templates', 'vehicleReady.html');
    readFileSync(templatePath); // test di accesso
  } catch {
    templatePath = join(process.cwd(), 'api', 'templates', 'vehicleReady.html');
  }

  let html = readFileSync(templatePath, 'utf8');

  const clienteAvvisatoTxt = vehicle.clienteAvvisato?.si
    ? `Sì${vehicle.clienteAvvisato?.data ? ` (${formatDate(vehicle.clienteAvvisato.data)})` : ''}`
    : 'No';

  const inviatoIl = new Date().toLocaleString('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const placeholders = {
    STATUS:                       labelStatus(vehicle.status),
    URGENTE:                      fmt(vehicle.urgente, 'bool'),
    COMMITTENTE:                  fmt(vehicle.committente),
    NUMERO_TELAIO:                fmt(vehicle.numeroTelaio),
    TARGA:                        fmt(vehicle.targa),
    ORDINE_SAP:                   fmt(vehicle.ordineSAP),
    TIPO_ALLESTIMENTO:            fmt(vehicle.tipoAllestimento),
    DESCRIZIONE_ALLESTIMENTO:     fmt(vehicle.descrizioneAllestimento),
    CODICE_ALLESTIMENTO_SAP:      fmt(vehicle.codiceAllestimentoSAP),
    DESCRIZIONE_ALLESTIMENTO_SAP: fmt(vehicle.descrizioneAllestimentoSAP),
    NUMERO_MATRICOLA:             fmt(vehicle.numeroMatricola),
    NUMERO_MATRICOLA_LIDERKIT:    fmt(vehicle.numeroMatricolaLiderkit),
    CODICE_INVENTARIO:            fmt(vehicle.codiceInventario),
    DATA_ARRIVO:                  fmt(vehicle.dataArrivo, 'date'),
    DATA_CONSEGNA:                fmt(vehicle.dataConsegna, 'date'),
    DATA_MONTAGGIO:               fmt(vehicle.dataMontaggio, 'date'),
    DATA_PREVISTA_MONTAGGIO:      fmt(vehicle.dataPrevistaMontaggio, 'date'),
    CODICE_ALLESTIMENTO:          fmt(vehicle.codiceAllestimento),
    CON_SPONDA_CARICATRICE:       fmt(vehicle.conSpondaCaricatrice, 'bool'),
    MARCA_SPONDA:                 fmt(vehicle.marcaSponda),
    MATRICOLA_SPONDA:             fmt(vehicle.matricolaSponda),
    WEEK_SPEDIZIONE_KIT:          fmt(vehicle.weekSpedizioneKit),
    COLLAUDO:                     fmt(vehicle.collaudo),
    DATA_COLLAUDO:                fmt(vehicle.dataCollaudo, 'date'),
    OMOLOGAZIONE_COLLAUDO:        fmt(vehicle.omologazioneCollaudo),
    COC_FASE_1:                   fmt(vehicle.cocFase1),
    COC_MANDATO:                  fmt(vehicle.cocMandato, 'bool'),
    MODALITA_RITIRO:              fmt(vehicle.modalitaRitiro),
    DATA_RITIRO:                  fmt(vehicle.dataRitiro, 'date'),
    ORA_MONTAGGIO:                fmt(vehicle.oraMontaggio),
    TIPO_CONSEGNA:                fmt(vehicle.tipoConsegna),
    MODALITA_CONSEGNA:            fmt(vehicle.modalitaConsegna),
    INDIRIZZO_CONSEGNA:           fmt(vehicle.indirizzoConsegna),
    CLIENTE_AVVISATO:             clienteAvvisatoTxt,
    STATO_RITIRO:                 labelStatoRitiro(vehicle.statoRitiro),
    RITIRO_SVOLTO:                fmt(vehicle.ritiroSvolto, 'bool'),
    RITIRO_GIORNO:                fmt(vehicle.ritiroGiorno),
    POSIZIONE_PARCHEGGIO:         fmt(vehicle.posizioneParcheggio),
    CHIAVI_DOPPIO_PARCHEGGIO:     fmt(vehicle.chiaviDoppioParcheggio),
    NOTE_RITIRO:                  fmt(vehicle.noteRitiro),
    PAGAMENTO_DOCUMENTI:          fmt(vehicle.pagamentoDocumenti),
    NOTE_PAGAMENTO:               fmt(vehicle.notePagamento),
    DOCUMENTI_MANDATI:            fmt(vehicle.documentiMandati, 'bool'),
    DATA_SPEDIZIONE_DOCUMENTI:    fmt(vehicle.dataSpedizioneDocumenti, 'date'),
    NUMERO_BOLLA_CONSEGNA:        fmt(vehicle.numeroBollaConsegna),
    NON:                          fmt(vehicle.non),
    NOME_DEALER:                  fmt(vehicle.nomeDealer),
    CODICE_DEALER:                fmt(vehicle.codiceDealer),
    CODICE_FORD:                  fmt(vehicle.codiceFord),
    CODICE_SCV:                   fmt(vehicle.codiceSCV),
    NOTE_PREZZO:                  fmt(vehicle.notePrezzo),
    DDT_OK_FGERACE:               fmt(vehicle.ddtOkOkFgerace),
    ALLEGATI:                     buildFilesHtml(vehicle.distinta, vehicle.files),
    NOTE:                         fmt(vehicle.note),
    INVIATO_IL:                   inviatoIl,
    VEHICLE_ID:                   vehicleId,
  };

  for (const [key, value] of Object.entries(placeholders)) {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), () => value);
  }
  return html;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  // Verifica Firebase ID token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: no token' });
  }

  try {
    initFirebase();
  } catch (err) {
    console.error('[sendVehicleReady] Firebase init error:', err.message);
    return res.status(500).json({ error: `Firebase init: ${err.message}` });
  }

  try {
    await getAuth().verifyIdToken(authHeader.slice(7));
  } catch (err) {
    return res.status(401).json({ error: `Token non valido: ${err.message}` });
  }

  const { vehicleId, vehicle } = req.body;
  if (!vehicleId || !vehicle) {
    return res.status(400).json({ error: 'Mancano vehicleId o vehicle' });
  }

  try {
    const db = getFirestore();
    const snap = await db.collection('config').doc('emailNotifications').get();

    if (!snap.exists || snap.data().enabled === false) {
      return res.status(200).json({ sent: false, reason: 'disabled' });
    }

    const recipients = (snap.data().recipients || [])
      .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e).trim()));

    if (recipients.length === 0) {
      return res.status(200).json({ sent: false, reason: 'no recipients' });
    }

    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      tls:    { rejectUnauthorized: false },
      connectionTimeout: 10000,
    });

    const subject = `Veicolo pronto – ${vehicle.ordineSAP || vehicle.numeroTelaio || vehicleId} – ${vehicle.committente || ''}`.trim();
    const html = buildEmailHtml(vehicleId, vehicle);

    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'SSV Manager <noreply@ssv-manager.it>',
      to:   recipients.join(', '),
      subject,
      html,
    });

    await db.collection('emailLogs').add({
      eventType:   'vehicle_ready',
      vehicleId,
      committente: vehicle.committente || null,
      ordineSAP:   vehicle.ordineSAP   || null,
      recipients,
      success:     true,
      error:       null,
      sentAt:      FieldValue.serverTimestamp(),
    });

    return res.status(200).json({ sent: true });
  } catch (err) {
    console.error('[sendVehicleReady] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
