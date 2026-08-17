// Transizione automatica di stato per appuntamenti montaggio scaduti.
// Sostituisce l'useEffect lato client in PianificazioneRitiriPage.jsx
// (hotspot §6.4 di ARCHITETTURA_SSV_MANAGER.md: iterava tutti i veicoli ad
// ogni cambio dell'array vehicles, cioè ad ogni render della pagina).
//
// Uso: FIREBASE_SA_KEY='<json service account>' node scripts/autoCompleteMontaggiAppuntamenti.js
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const SYSTEM_USER = 'Sistema (automatico)';

const raw = process.env.FIREBASE_SA_KEY;
if (!raw) {
  console.error('Manca FIREBASE_SA_KEY nell\'ambiente.');
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

async function logAction(action, vehicleInfo) {
  await db.collection('actions').add({
    userName: SYSTEM_USER,
    action,
    vehicleInfo: vehicleInfo || {},
    timestamp: FieldValue.serverTimestamp(),
    createdAt: new Date().toISOString(),
  });
}

async function freeParkingSpot(vehicleId) {
  const spotsSnap = await db.collection('parkingSpots').where('vehicleId', '==', vehicleId).get();
  for (const spotDoc of spotsSnap.docs) {
    await spotDoc.ref.delete();
  }
}

function isAppointmentPast(vehicle, now) {
  if (!vehicle.dataRitiro || !vehicle.oraMontaggio) return false;
  const [h, m] = vehicle.oraMontaggio.split(':').map(Number);
  const appt = new Date(vehicle.dataRitiro + 'T00:00:00');
  appt.setHours(h, m, 0, 0);
  return appt < now;
}

async function main() {
  const now = new Date();
  const snap = await db.collection('veicoli').where('modalitaRitiro', '==', 'montaggio').get();

  let transitioned = 0;
  for (const docSnap of snap.docs) {
    const vehicle = { id: docSnap.id, ...docSnap.data() };
    if (vehicle.status === 'ritirato' || vehicle.ritiroSvolto) continue;
    if (!isAppointmentPast(vehicle, now)) continue;

    try {
      await docSnap.ref.update({ status: 'ritirato', ritiroSvolto: true });
      await logAction('Appuntamento montaggio superato — stato aggiornato automaticamente a "ritirato"', {
        committente: vehicle.committente,
        numeroTelaio: vehicle.numeroTelaio,
      });
      await freeParkingSpot(vehicle.id);
      transitioned += 1;
      console.log(`[AutoMontaggi] ${vehicle.committente || vehicle.id}: transizione a "ritirato" completata.`);
    } catch (err) {
      console.error(`[AutoMontaggi] Errore su veicolo ${vehicle.id}:`, err.message);
    }
  }

  console.log(`[AutoMontaggi] Controllati ${snap.size} veicoli in modalità montaggio, ${transitioned} transizioni applicate.`);
}

main().catch(err => { console.error(err); process.exit(1); });
