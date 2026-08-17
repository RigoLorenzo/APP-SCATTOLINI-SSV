import { toISO, parseCSVDate } from './dateUtils';
import * as XLSX from 'xlsx';
import { collection, getDocs } from 'firebase/firestore';
import { ExcelJS, addSheet, downloadWorkbook } from './xlsxWriter';

/**
 * Parsa un file CSV o XLSX e restituisce un array di veicoli
 * @param {File} file - File CSV o XLSX da parsare
 * @returns {Promise<Array>} Array di veicoli parsati
 */
export async function parseCSV(file) {
  if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
    return parseXLSX(file);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
          reject(new Error('Il file CSV deve contenere almeno una riga di intestazione.'));
          return;
        }
        // Auto-rileva separatore: se la prima riga contiene ";" usalo, altrimenti ","
        const sep = lines[0].includes(';') ? ';' : ',';
        const rawHeaders = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));

        // Mappa per normalizzare i nomi degli header (case-insensitive)
        const normalizeHeader = (header) => {
          const lower = header.toLowerCase().trim();
          // Rimuovi spazi e caratteri speciali
          return lower.replace(/\s+/g, '');
        };

        const vehicles = [];
        for (let i = 1; i < lines.length; i++) {
          const values = [];
          let current = '';
          let inQuotes = false;
          for (let char of lines[i]) {
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === sep && !inQuotes) {
              values.push(current.trim().replace(/^"|"$/g, ''));
              current = '';
            } else {
              current += char;
            }
          }
          values.push(current.trim().replace(/^"|"$/g, ''));

          const vehicle = buildVehicleFromRow(rawHeaders, values);
          if (vehicle.committente && vehicle.dataConsegna) {
            vehicles.push(vehicle);
          }
        }
        resolve(vehicles);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Errore nella lettura del file'));
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * Funzione di mapping condivisa header → campo veicolo
 */
function buildVehicleFromRow(rawHeaders, values) {
  const normalizeHeader = (h) => h.toLowerCase().trim().replace(/\s+/g, '');

  const vehicle = {
    status: 'da-allestire', committente: '', dataArrivo: toISO(new Date()),
    dataConsegna: '', modalitaConsegna: '',
    tipoAllestimento: '', numeroTelaio: '', targa: '', chiaviDoppioParcheggio: '', posizioneParcheggio: '',
    codiceInventario: '', matricolaGruppoFrigo: '',
    ordineSAP: '', numeroMatricola: '', numeroMatricolaLiderkit: '', matricolaLiderkitRicevuta: false, weekSpedizioneKit: '',
    codiceAllestimento: '', descrizioneAllestimento: '', codiceAllestimentoSAP: '',
    descrizioneAllestimentoSAP: '', dataMontaggio: '', omologazioneCollaudo: '',
    collaudo: 'da-collaudare', dataCollaudo: '',
    clienteAvvisato: { si: false, data: '' },
    ritiroGiorno: '', cocFase1: '', pagamentoDocumenti: false,
    notePagamento: '', files: [], note: '',
    conSpondaCaricatrice: false, marcaSponda: '', matricolaSponda: '',
    documentiMandati: false, dataSpedizioneDocumenti: '',
    dataRitiro: '', modalitaRitiro: 'ritiro', tipoConsegna: 'bisarca',
    oraMontaggio: '', indirizzoConsegna: '', ritiroSvolto: false, noteRitiro: '',
    numeroBollaConsegna: '', non: '', nomeDealer: '', codiceDealer: '',
    codiceFord: '', codiceSCV: '', notePrezzo: '', ddtOkOkFgerace: ''
  };

  const normalizedHeaders = rawHeaders.map(h => normalizeHeader(h));

  rawHeaders.forEach((rawHeader, index) => {
    const value = String(values[index] ?? '').trim().replace(/^"|"$/g, '');
    if (!value) return;

    // "chiaviParcheggio" (nuova etichetta export) va mappato sul vecchio
    // campo dati "chiaviDoppioParcheggio" per restare compatibile col re-import.
    const vehicleKey = Object.keys(vehicle).find(key =>
      normalizeHeader(key) === normalizeHeader(rawHeader)
    ) || (normalizeHeader(rawHeader) === 'chiaviparcheggio' ? 'chiaviDoppioParcheggio' : undefined);

    if (vehicleKey) {
      if (normalizeHeader(rawHeader).includes('data') && value) {
        vehicle[vehicleKey] = parseCSVDate(value);
      } else if (vehicleKey === 'pagamentoDocumenti' || vehicleKey === 'conSpondaCaricatrice' || vehicleKey === 'ritiroSvolto' || vehicleKey === 'documentiMandati' || vehicleKey === 'matricolaLiderkitRicevuta') {
        const vl = value.toLowerCase().trim();
        vehicle[vehicleKey] = vl === 'true' || vl === '1' || vl === 'si' || vl === 'sì';
      } else {
        vehicle[vehicleKey] = value;
      }
    }
  });

  // Mapping esplicito per i campi flat clienteAvvisatoSi / clienteAvvisatoData
  // (non corrispondono al key nested "clienteAvvisato" nel loop standard)
  const siIdx = normalizedHeaders.indexOf('clienteavvisatosi');
  if (siIdx !== -1 && values[siIdx] !== undefined) {
    const v = String(values[siIdx]).toLowerCase().trim();
    vehicle.clienteAvvisato.si = v === 'si' || v === 'sì' || v === 'true' || v === '1';
  }
  const dataIdx = normalizedHeaders.indexOf('clienteavvisatodata');
  if (dataIdx !== -1 && values[dataIdx]) {
    vehicle.clienteAvvisato.data = parseCSVDate(String(values[dataIdx]));
  }

  return vehicle;
}

/**
 * Parsa un file XLSX e restituisce un array di veicoli
 */
function parseXLSX(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (rows.length < 2) {
          reject(new Error('Il file deve contenere almeno una riga di intestazione.'));
          return;
        }

        const rawHeaders = rows[0].map(h => String(h).trim());
        const vehicles = [];

        for (let i = 1; i < rows.length; i++) {
          const values = rows[i].map((cell, colIndex) => {
            // cellDates: true converte celle con formato data → Date object
            if (cell instanceof Date) {
              const y = cell.getFullYear();
              const m = String(cell.getMonth() + 1).padStart(2, '0');
              const d = String(cell.getDate()).padStart(2, '0');
              return `${d}/${m}/${y}`;
            }
            // Celle con formato "Generale": Excel salva le date come numero seriale.
            // Le convertiamo solo se la colonna è una colonna data (header contiene "data").
            if (typeof cell === 'number' && Number.isInteger(cell) && cell > 1 && cell < 109574) {
              const headerNorm = String(rawHeaders[colIndex] ?? '').toLowerCase().replace(/\s+/g, '');
              if (headerNorm.includes('data')) {
                const parsed = XLSX.SSF.parse_date_code(cell);
                if (parsed) {
                  return `${String(parsed.d).padStart(2, '0')}/${String(parsed.m).padStart(2, '0')}/${parsed.y}`;
                }
              }
            }
            return cell;
          });

          const vehicle = buildVehicleFromRow(rawHeaders, values);
          if (vehicle.committente && vehicle.dataConsegna) {
            vehicles.push(vehicle);
          }
        }

        resolve(vehicles);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(new Error('Errore nella lettura del file'));
    reader.readAsArrayBuffer(file);
  });
}

const bool = (v) => (v === true || v === 'true') ? 'Sì' : (v === false || v === 'false') ? 'No' : '';
const fileNames = (v) => Array.isArray(v) ? v.map(f => f?.name).filter(Boolean).join(', ') : (v?.name || '');

/**
 * Definizione unica (chiave dato → titolo colonna) usata sia da
 * `exportCompleteXLSX` (sotto) sia dall'export "Backup Locale"
 * (`SHEET_HEADERS.veicoli` in `src/utils/backupUtils.js`, che la importa
 * direttamente) così le due esportazioni XLSX restano sempre allineate:
 * aggiungere/rimuovere un campo qui basta ad aggiornare entrambe.
 */
export const VEHICLE_EXPORT_COLUMNS = [
  { key: 'status',                    label: 'Stato' },
  { key: 'urgente',                   label: 'Urgente',                  bool: true },
  { key: 'committente',               label: 'Committente' },
  { key: 'numeroTelaio',              label: 'N° Telaio' },
  { key: 'targa',                     label: 'Targa' },
  { key: 'tipoAllestimento',          label: 'Tipo Allestimento' },
  { key: 'descrizioneAllestimento',   label: 'Descrizione Allestimento' },
  { key: 'descrizioneAllestimentoSAP',label: 'Descrizione Allestimento SAP' },
  { key: 'codiceAllestimento',        label: 'Codice Allestimento' },
  { key: 'codiceAllestimentoSAP',     label: 'Codice Allestimento SAP' },
  { key: 'codiceInventario',          label: 'Codice Inventario' },
  { key: 'matricolaGruppoFrigo',      label: 'Matr. Gruppo Frigo' },
  { key: 'ordineSAP',                 label: 'N° Ordine SAP' },
  { key: 'numeroMatricola',           label: 'N° Matricola' },
  { key: 'numeroMatricolaLiderkit',   label: 'N° Matricola Liderkit' },
  { key: 'matricolaLiderkitRicevuta', label: 'N° Matricola Liderkit Ricevuto', bool: true },
  { key: 'weekSpedizioneKit',         label: 'Week Spedizione Kit' },
  { key: 'dataArrivo',                label: 'Data Arrivo' },
  { key: 'dataConsegna',              label: 'Data Consegna' },
  { key: 'dataMontaggio',             label: 'Data Montaggio' },
  { key: 'oraMontaggio',              label: 'Ora Montaggio' },
  { key: 'modalitaConsegna',          label: 'Modalità Consegna' },
  { key: 'modalitaRitiro',            label: 'Modalità Ritiro' },
  { key: 'statoRitiro',               label: 'Stato Ritiro' },
  { key: 'tipoConsegna',              label: 'Tipo Consegna' },
  { key: 'indirizzoConsegna',         label: 'Indirizzo Consegna' },
  { key: 'dataRitiro',                label: 'Data Ritiro' },
  { key: 'ritiroSvolto',              label: 'Ritiro Svolto',            bool: true },
  { key: 'noteRitiro',                label: 'Note Ritiro' },
  { key: 'ritiroGiorno',              label: 'Giorno Ritiro' },
  { key: 'collaudo',                  label: 'Collaudo' },
  { key: 'dataCollaudo',              label: 'Data Collaudo' },
  { key: 'omologazioneCollaudo',      label: 'Omologazione Collaudo' },
  { key: 'cocFase1',                  label: 'COC Fase 1' },
  { key: 'cocMandato',                label: 'COC Ricevuto',             bool: true },
  { key: 'conSpondaCaricatrice',      label: 'Con Sponda Caricatrice',   bool: true },
  { key: 'marcaSponda',               label: 'Marca Sponda' },
  { key: 'matricolaSponda',           label: 'Matricola Sponda' },
  { key: 'pagamentoDocumenti',        label: 'Documenti Pagati',         bool: true },
  { key: 'notePagamento',             label: 'Note Pagamento' },
  { key: 'documentiMandati',          label: 'Documenti Mandati',        bool: true },
  { key: 'dataSpedizioneDocumenti',   label: 'Data Spedizione Documenti' },
  { key: 'clienteAvvisato_si',        label: 'Cliente Avvisato',         nested: (v) => bool(v?.clienteAvvisato?.si) },
  { key: 'clienteAvvisato_data',      label: 'Data Avviso Cliente',      nested: (v) => v?.clienteAvvisato?.data || '' },
  { key: 'posizioneParcheggio',       label: 'Posizione Parcheggio' },
  { key: 'chiaviDoppioParcheggio',    label: 'Chiavi parcheggio' },
  { key: 'note',                      label: 'Note' },
  { key: 'distinta',                  label: 'Distinta',                 nested: (v) => fileNames(v.distinta) },
  { key: 'files',                     label: 'File Allegati',            nested: (v) => fileNames(v.files) },
  { key: 'numeroBollaConsegna',       label: 'N° Bolla Consegna',        adminOnly: true },
  { key: 'non',                       label: 'NON',                      adminOnly: true },
  { key: 'nomeDealer',                label: 'Nome Dealer',              adminOnly: true },
  { key: 'codiceDealer',              label: 'Codice Dealer',            adminOnly: true },
  { key: 'codiceFord',                label: 'Codice Ford',              adminOnly: true },
  { key: 'codiceSCV',                 label: 'Codice SCV',               adminOnly: true },
  { key: 'notePrezzo',                label: 'Note Prezzo',              adminOnly: true },
  { key: 'ddtOkOkFgerace',            label: 'DDT OK Fgerace',           adminOnly: true },
];

/**
 * Definizione colonne per il foglio "Materiale LDK a Stock" (collection
 * Firestore `kits`, stessa pagina/etichetta di `KitsPage.jsx`). Usata sia da
 * `exportCompleteXLSX` (sotto) sia da `SHEET_HEADERS.kits` in
 * `src/utils/backupUtils.js`, che la importa direttamente.
 */
export const KIT_EXPORT_COLUMNS = [
  { key: 'cliente',                 label: 'Cliente' },
  { key: 'numeroMatricolaLiderkit', label: 'N° Matricola Liderkit' },
  { key: 'categoria',               label: 'Categoria' },
  { key: 'dimensioniKit',           label: 'Dimensioni Kit' },
  { key: 'dataConsegnaMateriale',   label: 'Data Consegna Materiale' },
  { key: 'specifiche',              label: 'Specifiche' },
  { key: 'files',                   label: 'File Allegati', nested: (k) => fileNames(k.files) },
];

/**
 * Esporta in un unico XLSX la situazione completa: un foglio "Veicoli" con
 * tutte le colonne, e un secondo foglio "Materiale LDK a Stock" con tutto il
 * materiale a magazzino (collection `kits`, letta live da Firestore).
 * @param {Array} vehicles - Tutti i veicoli
 * @param {boolean} isAdmin - se false, le colonne Admin Ford vengono escluse
 *   dall'export (coerenza con la visibilità già applicata in VehicleModal)
 * @param {import('firebase/firestore').Firestore} db - istanza Firestore,
 *   usata per leggere il materiale LDK a stock al momento dell'export
 */
export async function exportCompleteXLSX(vehicles, isAdmin = false, db = null) {
  if (!vehicles || vehicles.length === 0) return false;

  const HEADERS = VEHICLE_EXPORT_COLUMNS.filter(h => isAdmin || !h.adminOnly);

  const labels = HEADERS.map(h => h.label);
  const rows = vehicles.map(v => HEADERS.map(h => {
    let val;
    if (h.nested) val = h.nested(v);
    else if (h.bool) val = bool(v[h.key]);
    else val = v[h.key];
    return val == null ? '' : String(val);
  }));

  const workbook = new ExcelJS.Workbook();
  addSheet(workbook, 'Veicoli', labels, rows);

  if (db) {
    const kitsSnap = await getDocs(collection(db, 'kits'));
    const kits = kitsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const kitLabels = KIT_EXPORT_COLUMNS.map(c => c.label);
    const kitRows = kits.map(k => KIT_EXPORT_COLUMNS.map(c => {
      const val = c.nested ? c.nested(k) : k[c.key];
      return val == null ? '' : String(val);
    }));
    addSheet(workbook, 'Materiale LDK a Stock', kitLabels, kitRows);
  }

  const today = new Date().toISOString().split('T')[0];
  await downloadWorkbook(workbook, `situazione_completa_${today}.xlsx`);
  return true;
}
