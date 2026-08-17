import { useState } from 'react';
import { Upload } from 'lucide-react';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useNotification } from '../../contexts/NotificationContext';
import { useUser } from '../../contexts/UserContext';
import { parseCSV } from '../../utils/csvUtils';
import { validateVehicle } from '../../utils/validationUtils';
import { fmtDMY } from '../../utils/dateUtils';
import Modal from '../Common/Modal';

const ADMIN_FIELDS = ['numeroBollaConsegna', 'non', 'nomeDealer', 'codiceDealer', 'codiceFord', 'codiceSCV', 'notePrezzo', 'ddtOkOkFgerace'];

const ImportCSVModal = ({ onClose, onImport }) => {
  const { showToast } = useNotification();
  const { isAdmin } = useUser();
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState([]);
  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;
    const validExt = ['.csv', '.xlsx', '.xls'];
    if (!validExt.some(ext => selectedFile.name.toLowerCase().endsWith(ext))) {
      showToast('Seleziona un file CSV o Excel (.xlsx, .xls, .csv).', 'error');
      return;
    }
    setFile(selectedFile);
    try {
      const vehicles = await parseCSV(selectedFile);
      setPreview(vehicles);
    } catch (error) {
      showToast(`Errore: ${error.message}`, 'error');
      setFile(null);
    }
  };
  const handleImport = async () => {
    if (!file || preview.length === 0) return;
    const validVehicles = preview.filter(v => validateVehicle(v).isValid).map(v => {
      if (isAdmin) return v;
      const stripped = { ...v };
      ADMIN_FIELDS.forEach(f => { stripped[f] = ''; });
      return stripped;
    });
    const skipped = preview.length - validVehicles.length;
    if (validVehicles.length === 0) {
      showToast('Nessun veicolo valido da importare. Verifica committente e data consegna.', 'error');
      return;
    }
    setImporting(true);
    try {
      for (let i = 0; i < validVehicles.length; i += 500) {
        const chunk = validVehicles.slice(i, i + 500);
        const batch = writeBatch(db);
        chunk.forEach(v => {
          const ref = doc(collection(db, 'veicoli'));
          batch.set(ref, v);
        });
        await batch.commit();
      }
      const msg = skipped > 0
        ? `Importati ${validVehicles.length} veicoli. ${skipped} saltati per dati mancanti.`
        : `Importati ${validVehicles.length} veicoli con successo!`;
      showToast(msg, skipped > 0 ? 'info' : 'success');
      onImport();
      onClose();
    } catch (error) {
      showToast(`Errore: ${error.message}`, 'error');
    } finally {
      setImporting(false);
    }
  };
  return (
    <Modal
      title={<div className="flex items-center gap-2"><Upload size={24} /><h2 className="text-xl font-bold">Importa CSV</h2></div>}
      headerColor="green"
      onClose={onClose}
      disableClose={importing}
      size="4xl"
      className="max-h-[90vh] overflow-y-auto"
      headerClassName="sticky top-0"
    >
      <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} disabled={importing} className="block w-full text-sm border-2 border-dashed border-gray-300 rounded-lg px-3 py-3 cursor-pointer" />
      {preview.length > 0 && (
        <div className="mt-4">
          <h3 className="font-bold text-lg mb-2">{preview.length} veicoli trovati</h3>
          <div className="border rounded-lg max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100 sticky top-0">
                <tr><th className="p-2 text-left">Committente</th><th className="p-2 text-left">Consegna</th><th className="p-2 text-left">Tipo</th></tr>
              </thead>
              <tbody>
                {preview.map((v, i) => (
                  <tr key={i} className="border-b"><td className="p-2">{v.committente}</td><td className="p-2">{fmtDMY(v.dataConsegna)}</td><td className="p-2">{v.tipoAllestimento}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div className="flex gap-3 mt-4">
        <button onClick={onClose} disabled={importing} className="flex-1 bg-gray-200 px-4 py-3 rounded-lg">Annulla</button>
        <button onClick={handleImport} disabled={!file || importing} className="flex-1 bg-green-600 text-white px-4 py-3 rounded-lg disabled:opacity-50">{importing ? 'Importazione...' : `Importa ${preview.length}`}</button>
      </div>
    </Modal>
  );
};

export default ImportCSVModal;
