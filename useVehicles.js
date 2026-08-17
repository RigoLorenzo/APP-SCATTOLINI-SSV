import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';

export function useVehicles() {
  const { currentUser } = useAuth();
  const { showToast } = useNotification();
  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);

  useEffect(() => {
    if (!currentUser) return;

    const q = query(collection(db, 'veicoli'), orderBy('dataConsegna', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setVehicles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoadingVehicles(false);
      },
      (error) => {
        console.error('veicoli listener error:', error);
        setLoadingVehicles(false);
        showToast('Errore caricamento veicoli. Ricarica la pagina.', 'error');
      }
    );

    return unsubscribe;
  }, [currentUser]);

  return { vehicles, loadingVehicles };
}
