import { AlertCircle } from 'lucide-react';
import Modal from '../Common/Modal';

// z-[60]: il ConfirmModal è un dialog globale (montato in App.jsx, usato via
// showConfirm() da qualunque altro modale, es. VehicleModal) e deve quindi
// comparire sempre sopra qualunque altro modale (tutti a z-50 di default),
// indipendentemente da chi dei due è stato montato per ultimo nel DOM.
const ConfirmModal = ({ message, onConfirm, onClose }) => (
  <Modal size="sm" zIndexClass="z-[60]">
    <div className="flex items-start gap-3 mb-5">
      <AlertCircle size={22} className="text-orange-500 flex-shrink-0 mt-0.5" />
      <p className="text-gray-800 text-sm leading-relaxed">{message}</p>
    </div>
    <div className="flex gap-3 justify-end">
      <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium">Annulla</button>
      <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 font-medium">Conferma</button>
    </div>
  </Modal>
);

export default ConfirmModal;
