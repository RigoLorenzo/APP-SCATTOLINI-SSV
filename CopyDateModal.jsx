import { useState } from 'react';
import { toISO } from '../../utils/dateUtils';
import Modal from '../Common/Modal';

const CopyDateModal = ({ vehicle, onClose, onCopy }) => {
  const [selectedDate, setSelectedDate] = useState(toISO(new Date()));
  return (
    <Modal
      title={<h2 className="text-xl font-bold">Copia Veicolo</h2>}
      headerColor="blue"
      onClose={onClose}
    >
      <div className="mb-4 bg-blue-50 p-3 rounded">
        <p className="font-semibold">{vehicle.committente}</p>
        <p className="text-sm text-gray-600">Telaio: {vehicle.numeroTelaio || 'N/A'}</p>
      </div>
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Nuova data consegna</label>
        <input type="date" className="w-full border-2 border-gray-300 rounded-lg px-4 py-3" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
      </div>
      <div className="flex gap-3">
        <button onClick={onClose} className="flex-1 bg-gray-200 px-4 py-3 rounded-lg">Annulla</button>
        <button onClick={() => onCopy(selectedDate)} className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg">Copia</button>
      </div>
    </Modal>
  );
};

export default CopyDateModal;
