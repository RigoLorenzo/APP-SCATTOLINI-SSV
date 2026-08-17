import { useState } from 'react';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, writeBatch } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import { db, storage, logAction, releaseParkingSpotForVehicle } from '../firebase';
import { toISO } from '../utils/dateUtils';
import { useUser } from '../contexts/UserContext';
import { useNotification } from '../contexts/NotificationContext';

async function triggerVehicleReadyEmail(vehicleId, vehicle, showToast) {
  try {
    const token = await getAuth().currentUser?.getIdToken();
    if (!token) { showToast('Email: utente non autenticato', 'error'); return; }
    const res = await fetch('/api/sendVehicleReady', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ vehicleId, vehicle }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.sent) {
      showToast('Notifica email "Veicolo Pronto" inviata', 'success');
    } else if (res.ok) {
      console.log('[Email] Non inviata:', data.reason);
    } else {
      showToast(`Errore invio email (${res.status}): ${data.error || 'sconosciuto'}`, 'error');
    }
  } catch (err) {
    showToast(`Errore invio email: ${err.message}`, 'error');
  }
}

export function useVehicleCrud(vehicles) {
  const { userName, isReadOnly } = useUser();
  const { showToast, showConfirm } = useNotification();

  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [vehicleToCopy, setVehicleToCopy] = useState(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const handleAddVehicle = () => {
    if (isReadOnly) return;
    setEditingVehicle(null);
    setShowVehicleModal(true);
  };

  const handleEditVehicle = (vehicle) => {
    setEditingVehicle(vehicle);
    setShowVehicleModal(true);
  };

  const handleSaveVehicle = async (vehicleData) => {
    try {
      if (editingVehicle) {
        const oldStatus = editingVehicle.status;
        const newStatus = vehicleData.status;
        const statusChanged = oldStatus !== newStatus;

        await updateDoc(doc(db, 'veicoli', editingVehicle.id), vehicleData);
        await logAction(userName, 'Modifica Veicolo', { committente: vehicleData.committente, numeroTelaio: vehicleData.numeroTelaio });

        if (statusChanged) {
          const statusLabels = {
            'da-allestire': 'Da Allestire',
            'in-allestimento': 'In Allestimento',
            'pronto': 'Pronto',
            'ritirato': 'Ritirato'
          };
          showToast(
            `Veicolo "${vehicleData.committente}" cambiato da "${statusLabels[oldStatus]}" a "${statusLabels[newStatus]}"`,
            'success'
          );
          await logAction(userName, `Cambio stato: ${oldStatus} → ${newStatus}`, {
            committente: vehicleData.committente,
            numeroTelaio: vehicleData.numeroTelaio
          });

          if (oldStatus !== 'pronto' && newStatus === 'pronto') {
            triggerVehicleReadyEmail(editingVehicle.id, vehicleData, showToast);
          }

          // Libera automaticamente la posizione parcheggio quando il veicolo diventa "ritirato"
          if (newStatus === 'ritirato') {
            const freed = await releaseParkingSpotForVehicle(editingVehicle.id);
            if (freed) {
              await logAction(userName, 'Parcheggio liberato automaticamente (veicolo ritirato)', {
                committente: vehicleData.committente,
                numeroTelaio: vehicleData.numeroTelaio
              });
            }
          }
        } else {
          showToast(`Veicolo "${vehicleData.committente}" salvato con successo`, 'success');
        }
      } else {
        await addDoc(collection(db, 'veicoli'), vehicleData);
        await logAction(userName, 'Creazione Veicolo', { committente: vehicleData.committente, numeroTelaio: vehicleData.numeroTelaio });
        showToast(`Veicolo "${vehicleData.committente}" creato con successo`, 'success');
      }
      setShowVehicleModal(false);
      setEditingVehicle(null);
    } catch (error) {
      console.error('Errore:', error);
      showToast('Errore durante il salvataggio del veicolo', 'error');
    }
  };

  const handleDeleteVehicle = async (vehicleId) => {
    if (isReadOnly) return false;
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!await showConfirm(`Eliminare il veicolo ${vehicle?.committente}?`)) return false;

    try {
      if (vehicle.files && vehicle.files.length > 0) {
        for (const file of vehicle.files) {
          if (file.storagePath) {
            try {
              const fileRef = ref(storage, file.storagePath);
              await deleteObject(fileRef);
            } catch (error) {
              console.error('Errore eliminazione file:', error);
            }
          }
        }
      }
      await deleteDoc(doc(db, 'veicoli', vehicleId));
      await logAction(userName, 'Eliminazione Veicolo', { committente: vehicle?.committente, numeroTelaio: vehicle?.numeroTelaio });
      return true;
    } catch (error) {
      console.error('Errore:', error);
      showToast('Errore durante l\'eliminazione del veicolo.', 'error');
      return false;
    }
  };

  const handleCopyVehicle = (vehicle) => {
    if (isReadOnly) return;
    setVehicleToCopy(vehicle);
    setShowCopyModal(true);
  };

  const handleConfirmCopy = async (newDate) => {
    if (!vehicleToCopy) return;
    try {
      const newVehicle = {
        ...vehicleToCopy,
        dataConsegna: newDate,
        dataArrivo: toISO(new Date()),
        status: 'da-allestire'
      };
      delete newVehicle.id;
      await addDoc(collection(db, 'veicoli'), newVehicle);
      await logAction(userName, 'Copia Veicolo', { committente: vehicleToCopy.committente, nuovaData: newDate });
      setShowCopyModal(false);
      setVehicleToCopy(null);
    } catch (error) {
      console.error('Errore:', error);
      showToast('Errore durante la copia del veicolo.', 'error');
    }
  };

  const handleDeleteAll = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'veicoli'));
      const totalDocs = snapshot.docs.length;

      if (totalDocs === 0) {
        showToast('Nessun veicolo da eliminare.', 'info');
        setShowDeleteAllModal(false);
        return;
      }

      const batchSize = 500;
      const batches = [];
      let currentBatch = writeBatch(db);
      let operationCount = 0;

      for (const document of snapshot.docs) {
        currentBatch.delete(doc(db, 'veicoli', document.id));
        operationCount++;
        if (operationCount === batchSize) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          operationCount = 0;
        }
      }
      if (operationCount > 0) batches.push(currentBatch);
      await Promise.all(batches.map(batch => batch.commit()));

      const parkingSnapshot = await getDocs(collection(db, 'parkingSpots'));
      if (parkingSnapshot.docs.length > 0) {
        const parkingBatches = [];
        let parkingBatch = writeBatch(db);
        let parkingOpCount = 0;
        for (const parkingDoc of parkingSnapshot.docs) {
          parkingBatch.delete(doc(db, 'parkingSpots', parkingDoc.id));
          parkingOpCount++;
          if (parkingOpCount === batchSize) {
            parkingBatches.push(parkingBatch);
            parkingBatch = writeBatch(db);
            parkingOpCount = 0;
          }
        }
        if (parkingOpCount > 0) parkingBatches.push(parkingBatch);
        await Promise.all(parkingBatches.map(batch => batch.commit()));
      }

      await logAction(userName, 'Eliminazione Massiva', { count: totalDocs });
      setShowDeleteAllModal(false);
    } catch (error) {
      console.error('Errore durante eliminazione massiva:', error);
      showToast('Errore durante l\'eliminazione. Riprova.', 'error');
    }
  };

  return {
    showVehicleModal, setShowVehicleModal,
    editingVehicle, setEditingVehicle,
    showCopyModal, setShowCopyModal,
    vehicleToCopy,
    showDeleteAllModal, setShowDeleteAllModal,
    showImportModal, setShowImportModal,
    handleAddVehicle,
    handleEditVehicle,
    handleSaveVehicle,
    handleDeleteVehicle,
    handleCopyVehicle,
    handleConfirmCopy,
    handleDeleteAll,
  };
}
