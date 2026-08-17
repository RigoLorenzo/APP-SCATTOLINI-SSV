import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';

/**
 * Logga un'azione nel database
 * @param {Object} db - Istanza Firestore
 * @param {string} userName - Nome utente che esegue l'azione
 * @param {string} action - Descrizione azione
 * @param {Object} vehicleInfo - Informazioni veicolo
 */
export async function logAction(db, userName, action, vehicleInfo) {
  try {
    await addDoc(collection(db, 'actions'), {
      userName,
      action,
      vehicleInfo: vehicleInfo || {},
      timestamp: serverTimestamp(),
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Errore log:', error);
  }
}

/**
 * Libera (elimina) la posizione parcheggio eventualmente assegnata a un
 * veicolo. Punto unico usato ovunque un veicolo passi a stato "ritirato"
 * (form scheda veicolo, quick-toggle "Ritiro/Consegna svolto" da calendario),
 * per evitare di duplicare la query/delete su `parkingSpots` in più file.
 * @returns {Promise<boolean>} true se una posizione è stata liberata
 */
export async function releaseParkingSpotForVehicle(db, vehicleId) {
  const q = query(collection(db, 'parkingSpots'), where('vehicleId', '==', vehicleId));
  const snapshot = await getDocs(q);
  for (const spotDoc of snapshot.docs) {
    await deleteDoc(doc(db, 'parkingSpots', spotDoc.id));
  }
  return !snapshot.empty;
}
