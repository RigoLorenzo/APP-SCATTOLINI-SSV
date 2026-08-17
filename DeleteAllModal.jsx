import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import Modal from '../Common/Modal';

const DeleteAllModal = ({ onClose, onConfirm, vehicleCount }) => {
  const [deleting, setDeleting] = useState(false);
  const handleConfirm = async () => {
    setDeleting(true);
    await onConfirm();
    setDeleting(false);
  };
  return (
    <Modal
      title={<div className="flex items-center gap-2"><AlertCircle size={24} /><h2 className="text-xl font-bold">Conferma Eliminazione</h2></div>}
      headerColor="red"
      onClose={onClose}
      disableClose={deleting}
      closeButtonClassName="text-white hover:text-gray-200"
    >
      <div className="mb-6">
        <p className="text-gray-800 font-semibold mb-2">⚠️ Attenzione!</p>
        <p className="text-gray-600 text-sm mb-3">Stai per eliminare <strong>TUTTE le {vehicleCount} schede</strong>.</p>
        <p className="text-red-600 text-sm font-medium">Azione <strong>IRREVERSIBILE</strong>!</p>
      </div>
      <div className="flex gap-3">
        <button onClick={onClose} disabled={deleting} className="flex-1 bg-gray-200 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-300 font-medium disabled:opacity-50">Annulla</button>
        <button onClick={handleConfirm} disabled={deleting} className="flex-1 bg-red-600 text-white px-4 py-3 rounded-lg hover:bg-red-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50">{deleting ? 'Eliminazione...' : 'Elimina Tutto'}</button>
      </div>
    </Modal>
  );
};

export default DeleteAllModal;
