import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { VEHICLE_EXPORT_COLUMNS, KIT_EXPORT_COLUMNS } from './csvUtils';
import { ExcelJS, addSheet, downloadWorkbook, workbookToUint8Array } from './xlsxWriter';

/**
 * Collezioni Firestore da includere nel backup
 */
const BACKUP_COLLECTIONS = [
  { name: 'veicoli', orderField: 'dataConsegna' },
  { name: 'kits', orderField: null },
  { name: 'telai', orderField: null },
  { name: 'actions', orderField: null },
  { name: 'messages', orderField: null },
  { name: 'parkingSpots', orderField: null },
];

// Campi visibili/editabili solo da admin (stessa lista di firestore.rules
// adminFields() e ImportCSVModal.jsx ADMIN_FIELDS) — esclusi dal backup se
// chi lo esegue non è admin.
const ADMIN_FIELDS = ['numeroBollaConsegna', 'non', 'nomeDealer', 'codiceDealer', 'codiceFord', 'codiceSCV', 'notePrezzo', 'ddtOkOkFgerace'];

/**
 * Header per ogni collezione — definisce le colonne e l'ordine di esportazione.
 *
 * `veicoli` e `kits` sono generate da `VEHICLE_EXPORT_COLUMNS`/`KIT_EXPORT_COLUMNS`
 * (`src/utils/csvUtils.js`), le stesse liste usate da `exportCompleteXLSX`:
 * aggiungendo/rimuovendo un campo lì, questo export resta automaticamente allineato.
 */
const SHEET_HEADERS = {
  veicoli: VEHICLE_EXPORT_COLUMNS.map(c => c.key),
  kits: KIT_EXPORT_COLUMNS.map(c => c.key),
  telai: [
    'numeroTelaio', 'committente', 'dataArrivoVeicolo', 'chiaviDoppioParcheggio', 'note'
  ],
  actions: [
    'userName', 'action', 'vehicleInfo', 'createdAt'
  ],
  messages: [
    'userName', 'message', 'createdAt'
  ],
  // Il documento reale non ha campi flat "spotId"/"targa"/"committente": sono
  // rispettivamente l'id documento e due sotto-campi di "vehicleData" (snapshot
  // denormalizzato del veicolo assegnato, copiato da ParcheggioPage al momento
  // dell'assegnazione — vedi ARCHITETTURA_SSV_MANAGER.md §5). Le label restano
  // invariate per compatibilità con i backup già salvati, ma la risoluzione del
  // valore in resolveField() ora punta ai campi giusti (prima erano sempre vuoti).
  parkingSpots: [
    'spotId', 'vehicleId', 'targa', 'committente', 'status', 'assignedAt', 'assignedBy'
  ],
};

/**
 * Titoli colonna leggibili per la riga di intestazione di ogni foglio.
 * `veicoli` riusa le stesse label di `VEHICLE_EXPORT_COLUMNS`; per le altre
 * collezioni (liste corte e stabili) le label sono mantenute qui.
 * Se un campo non ha una label esplicita, in intestazione compare la chiave
 * grezza (fallback in `collectionToRows`).
 */
const FIELD_LABELS = {
  veicoli: Object.fromEntries(VEHICLE_EXPORT_COLUMNS.map(c => [c.key, c.label])),
  kits: Object.fromEntries(KIT_EXPORT_COLUMNS.map(c => [c.key, c.label])),
  telai: {
    numeroTelaio: 'N° Telaio',
    committente: 'Committente',
    dataArrivoVeicolo: 'Data Arrivo Veicolo',
    chiaviDoppioParcheggio: 'Chiavi Parcheggio',
    note: 'Note',
  },
  actions: {
    userName: 'Utente',
    action: 'Azione',
    vehicleInfo: 'Veicolo',
    createdAt: 'Data e Ora',
  },
  messages: {
    userName: 'Utente',
    message: 'Messaggio',
    createdAt: 'Data e Ora',
  },
  parkingSpots: {
    spotId: 'Posto',
    vehicleId: 'ID Veicolo',
    targa: 'Targa',
    committente: 'Committente',
    status: 'Stato',
    assignedAt: 'Data Assegnazione',
    assignedBy: 'Assegnato Da',
  },
};

/**
 * Recupera tutti i dati da una collezione Firestore
 */
async function fetchCollection(db, col) {
  const q = col.orderField
    ? query(collection(db, col.name), orderBy(col.orderField, 'asc'))
    : collection(db, col.name);
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Recupera tutti i dati da tutte le collezioni
 */
export async function fetchAllData(db, selectedCollections = []) {
  const collections = selectedCollections.length > 0
    ? BACKUP_COLLECTIONS.filter(c => selectedCollections.includes(c.name))
    : BACKUP_COLLECTIONS;

  const results = {};
  const promises = collections.map(async (col) => {
    try {
      results[col.name] = await fetchCollection(db, col);
    } catch (error) {
      console.error(`Errore nel recupero di ${col.name}:`, error);
      results[col.name] = [];
    }
  });

  await Promise.all(promises);
  return results;
}

/**
 * Formatta una data/ora ISO (es. da new Date().toISOString() o serverTimestamp)
 * in formato leggibile it-IT, invece del timestamp raw.
 */
function formatDateTime(value) {
  if (!value) return '';
  const d = value?.toDate ? value.toDate() : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Nome file leggibile da un oggetto file { name, ... } o un array di essi */
function fileNames(value) {
  if (!value) return '';
  if (Array.isArray(value)) return value.map(f => f?.name).filter(Boolean).join(', ');
  return value.name || '';
}

/**
 * Legge un valore (anche nested) da un record per un dato header.
 * collectionName serve a disambiguare header identici tra collection diverse
 * (es. "targa"/"committente" sono campi diretti su "veicoli" ma sotto-campi
 * di "vehicleData" — snapshot denormalizzato — su "parkingSpots").
 */
function resolveField(record, header, collectionName) {
  if (header === 'clienteAvvisato_si') {
    return record.clienteAvvisato?.si ? 'Sì' : 'No';
  }
  if (header === 'clienteAvvisato_data') {
    return record.clienteAvvisato?.data || '';
  }
  if (header === 'pagamentoDocumenti' || header === 'documentiMandati' || header === 'conSpondaCaricatrice' || header === 'ritiroSvolto' || header === 'urgente' || header === 'cocMandato') {
    return record[header] ? 'Sì' : 'No';
  }
  if ((header === 'distinta' || header === 'files') && (collectionName === 'veicoli' || collectionName === 'kits')) {
    return fileNames(record[header]);
  }
  if (collectionName === 'parkingSpots') {
    if (header === 'spotId') return record.id || '';
    if (header === 'targa') return record.vehicleData?.targa || '';
    if (header === 'committente') return record.vehicleData?.committente || '';
    if (header === 'assignedAt') return formatDateTime(record.assignedAt);
  }
  if (header === 'createdAt') {
    return formatDateTime(record.createdAt);
  }
  const value = record[header];
  if (value && typeof value === 'object') {
    if (value.toDate) return formatDateTime(value);
    return JSON.stringify(value);
  }
  return value;
}

/**
 * Converte un array di record in righe (con intestazioni leggibili) per un
 * foglio XLSX. Restituisce { rows, labels } oppure null se non c'è nulla da
 * esportare.
 */
function collectionToRows(records, collectionName, isAdmin) {
  const headers = SHEET_HEADERS[collectionName]?.filter(h => isAdmin || !ADMIN_FIELDS.includes(h));
  if (!headers || records.length === 0) return null;

  const labels = headers.map(h => FIELD_LABELS[collectionName]?.[h] || h);

  const rows = records.map(record => headers.map(h => {
    let value = resolveField(record, h, collectionName);
    if (value === null || value === undefined) value = '';
    return String(value);
  }));

  return { rows, labels };
}

/**
 * Costruisce un workbook XLSX con un foglio per ogni collezione
 */
function buildWorkbook(data, isAdmin) {
  const workbook = new ExcelJS.Workbook();
  const sheetsAdded = [];

  for (const [collectionName, records] of Object.entries(data)) {
    if (!Array.isArray(records) || records.length === 0) continue;
    const result = collectionToRows(records, collectionName, isAdmin);
    if (!result) continue;
    const { rows, labels } = result;

    const sheetName = COLLECTION_LABELS[collectionName] || collectionName;
    addSheet(workbook, sheetName, labels, rows);
    sheetsAdded.push(sheetName);
  }

  return { workbook, sheetsAdded };
}

/**
 * Genera il prefisso timestamp per i nomi dei file
 */
export function getBackupTimestamp() {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toTimeString().slice(0, 8).replace(/:/g, '-');
  return `${date}_${time}`;
}

/**
 * Conta i record per ogni collezione
 */
export function getRecordCounts(data) {
  const counts = {};
  for (const [key, value] of Object.entries(data)) {
    counts[key] = Array.isArray(value) ? value.length : 0;
  }
  return counts;
}

// ─── File System Access API ─────────────────────────────────────────

export function isFileSystemAccessSupported() {
  return 'showDirectoryPicker' in window;
}

export async function saveDirectoryHandle(handle) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SSVBackupDB', 1);
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('handles');
    };
    request.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction('handles', 'readwrite');
      tx.objectStore('handles').put(handle, 'backupDir');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function loadDirectoryHandle() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SSVBackupDB', 1);
    request.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('handles');
    };
    request.onsuccess = (e) => {
      const db = e.target.result;
      const tx = db.transaction('handles', 'readonly');
      const getReq = tx.objectStore('handles').get('backupDir');
      getReq.onsuccess = () => resolve(getReq.result || null);
      getReq.onerror = () => reject(getReq.error);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function verifyPermission(handle) {
  if (!handle) return false;
  try {
    const options = { mode: 'readwrite' };
    if ((await handle.queryPermission(options)) === 'granted') return true;
    if ((await handle.requestPermission(options)) === 'granted') return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Scrive il backup XLSX nella cartella selezionata (File System Access API)
 * @returns {string} Nome del file scritto
 */
export async function writeXLSXBackupToDirectory(dirHandle, data, timestamp, isAdmin) {
  const { workbook, sheetsAdded } = buildWorkbook(data, isAdmin);
  if (sheetsAdded.length === 0) return null;

  const filename = `backup_${timestamp}.xlsx`;
  const bytes = await workbookToUint8Array(workbook);

  const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(bytes);
  await writable.close();

  return filename;
}

/**
 * Fallback: scarica il backup XLSX tramite download del browser
 * @returns {string} Nome del file scaricato
 */
export async function downloadXLSXBackup(data, timestamp, isAdmin) {
  const { workbook, sheetsAdded } = buildWorkbook(data, isAdmin);
  if (sheetsAdded.length === 0) return null;

  const filename = `backup_${timestamp}.xlsx`;
  await downloadWorkbook(workbook, filename);
  return filename;
}

// ─── Impostazioni auto-backup (localStorage) ───────────────────────

export function saveAutoBackupSettings(settings) {
  localStorage.setItem('ssv_autobackup', JSON.stringify(settings));
}

export function loadAutoBackupSettings() {
  try {
    const saved = localStorage.getItem('ssv_autobackup');
    return saved ? JSON.parse(saved) : { enabled: false, intervalHours: 24 };
  } catch {
    return { enabled: false, intervalHours: 24 };
  }
}

export function saveLastBackupTime() {
  localStorage.setItem('ssv_last_backup', new Date().toISOString());
}

export function getLastBackupTime() {
  return localStorage.getItem('ssv_last_backup') || null;
}

export function isBackupDue(intervalHours) {
  const last = getLastBackupTime();
  if (!last) return true;
  const elapsed = (Date.now() - new Date(last).getTime()) / (1000 * 60 * 60);
  return elapsed >= intervalHours;
}

/**
 * Nomi leggibili delle collezioni (usati come nomi dei fogli XLSX)
 */
export const COLLECTION_LABELS = {
  veicoli: 'Veicoli',
  kits: 'Materiale LDK a Stock',
  telai: 'Telai in Attesa di Ordine',
  actions: 'Log Azioni',
  messages: 'Messaggi Chat',
  parkingSpots: 'Posti Parcheggio',
};
