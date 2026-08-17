// Script di audit una tantum (non schedulato): campiona la collection
// `veicoli` e riporta la percentuale di documenti in cui ciascun "campo
// fantasma" (ARCHITETTURA_SSV_MANAGER.md §5) risulta valorizzato, per
// distinguere feature incompleta (dato presente, nessuna UI) da residuo
// legacy (dato mai scritto da nessun punto del codice).
//
// NON tocca la collection `parkingSpots`: il campo
// `parkingSpots.vehicleData.targa` è uno snapshot denormalizzato
// intenzionale (copiato da useVehicleCrud al momento dell'assegnazione
// del posto), non il campo master su `veicoli` — va escluso dall'analisi
// per esplicita indicazione del task, non ha senso campionarlo qui.
//
// Uso: FIREBASE_SA_KEY='<json service account>' node scripts/auditVehicleFields.js
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const raw = process.env.FIREBASE_SA_KEY;
if (!raw) {
  console.error('Manca FIREBASE_SA_KEY nell\'ambiente. Vedi scripts/sendWeeklyReport.js per il formato atteso.');
  process.exit(1);
}
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

const FIELDS = [
  'targa',
  'modello',
  'codiceInventario',
  'posizioneParcheggio',
  'ritiroGiorno',
  'cocFase1',
  'dataPrevistaMontaggio',
  'modalitaConsegna',
];

function isValorized(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

async function main() {
  const snap = await db.collection('veicoli').get();
  const total = snap.size;
  if (total === 0) {
    console.log('Collection "veicoli" vuota: nessun dato da campionare.');
    return;
  }

  const counts = Object.fromEntries(FIELDS.map(f => [f, 0]));
  snap.forEach(doc => {
    const data = doc.data();
    FIELDS.forEach(f => {
      if (isValorized(data[f])) counts[f] += 1;
    });
  });

  console.log(`Documenti campionati: ${total}\n`);
  console.log('Campo'.padEnd(24), 'Valorizzati', 'Percentuale');
  FIELDS.forEach(f => {
    const pct = ((counts[f] / total) * 100).toFixed(1);
    console.log(f.padEnd(24), String(counts[f]).padEnd(11), `${pct}%`);
  });
}

main().catch(err => { console.error(err); process.exit(1); });
