import { useState, useRef } from 'react';
import { X, Upload, Trash2, FileText, Image, Loader } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../../firebase';
import { useNotification } from '../../contexts/NotificationContext';
import { KIT_CATEGORIE } from '../../constants/kitCategories';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const MAX_SIZE_MB = 20;

const KitModal = ({ kit, onClose, onSave }) => {
  const { showToast, showConfirm } = useNotification();
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState(kit || {
    cliente: '',
    numeroMatricolaLiderkit: '',
    categoria: '',
    dimensioniKit: '',
    specifiche: '',
    dataConsegnaMateriale: '',
    files: [],
  });

  const files = formData.files || [];

  const handleFileAdd = async (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length === 0) return;

    const valid = selected.filter(f => {
      if (!ALLOWED_TYPES.includes(f.type)) {
        showToast(`"${f.name}": tipo non supportato (solo immagini e PDF).`, 'error');
        return false;
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        showToast(`"${f.name}": file troppo grande (max ${MAX_SIZE_MB} MB).`, 'error');
        return false;
      }
      return true;
    });
    if (valid.length === 0) { e.target.value = ''; return; }

    setUploading(true);
    try {
      const uploaded = await Promise.all(valid.map(async (file) => {
        try {
          const ts = Date.now();
          const rand = Math.random().toString(36).substring(2, 10);
          const safe = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const path = `kits/${ts}_${rand}_${safe}`;
          const snap = await uploadBytes(ref(storage, path), file);
          const downloadURL = await getDownloadURL(snap.ref);
          return { name: file.name, size: file.size, type: file.type, storagePath: path, downloadURL, uploadedAt: new Date().toISOString() };
        } catch {
          showToast(`Errore upload "${file.name}".`, 'error');
          return null;
        }
      }));
      const ok = uploaded.filter(Boolean);
      if (ok.length > 0) setFormData(prev => ({ ...prev, files: [...(prev.files || []), ...ok] }));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleFileRemove = async (index) => {
    const f = files[index];
    if (!await showConfirm(`Eliminare "${f.name}"?`)) return;
    try {
      if (f.storagePath) await deleteObject(ref(storage, f.storagePath));
    } catch (error) {
      // Un file già assente su Storage non deve impedire la rimozione del
      // riferimento in elenco (altrimenti resta agganciato per sempre).
      if (error.code !== 'storage/object-not-found') {
        showToast('Errore eliminazione file.', 'error');
        return;
      }
    }
    setFormData(prev => ({ ...prev, files: prev.files.filter((_, i) => i !== index) }));
  };

  const handleSave = () => {
    if (!formData.cliente || !formData.numeroMatricolaLiderkit || !formData.dimensioniKit) {
      showToast('Tutti i campi obbligatori devono essere compilati.', 'error');
      return;
    }
    if (uploading) {
      showToast('Attendi il caricamento dei file.', 'info');
      return;
    }
    onSave(formData);
  };

  const formatSize = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isImage = (f) => f.type?.startsWith('image/');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4 flex justify-between items-center rounded-t-lg flex-shrink-0">
          <h2 className="text-xl font-bold">{kit ? 'Modifica' : 'Nuovo'} Materiale LDK</h2>
          <button onClick={onClose} className="text-white hover:text-purple-200"><X size={24} /></button>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-4">
          {/* Campi principali */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Cliente *</label>
              <input type="text" className="w-full border border-gray-300 rounded px-3 py-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-200" value={formData.cliente} onChange={(e) => setFormData({ ...formData, cliente: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Matricola *</label>
              <input type="text" className="w-full border border-gray-300 rounded px-3 py-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-200" value={formData.numeroMatricolaLiderkit} onChange={(e) => setFormData({ ...formData, numeroMatricolaLiderkit: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Dimensioni *</label>
              <input type="text" className="w-full border border-gray-300 rounded px-3 py-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-200" value={formData.dimensioniKit} onChange={(e) => setFormData({ ...formData, dimensioniKit: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Categoria</label>
              <select className="w-full border border-gray-300 rounded px-3 py-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-200" value={formData.categoria || ''} onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}>
                <option value="">Seleziona...</option>
                {KIT_CATEGORIE.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Data consegna materiale</label>
              <input type="text" placeholder="es. settimana 20, 15/05, Q3..." className="w-full border border-gray-300 rounded px-3 py-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-200" value={formData.dataConsegnaMateriale || ''} onChange={(e) => setFormData({ ...formData, dataConsegnaMateriale: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Specifiche</label>
            <textarea className="w-full border border-gray-300 rounded px-3 py-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-200" rows="3" value={formData.specifiche} onChange={(e) => setFormData({ ...formData, specifiche: e.target.value })} />
          </div>

          {/* SEZIONE FILE */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <FileText size={18} className="text-purple-600" />
                Documenti e Foto
                {files.length > 0 && (
                  <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">{files.length}</span>
                )}
              </h3>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 bg-purple-600 text-white px-3 py-1.5 rounded-lg hover:bg-purple-700 text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {uploading ? <Loader size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploading ? 'Caricamento...' : 'Carica File'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf"
                className="hidden"
                onChange={handleFileAdd}
              />
            </div>
            <p className="text-xs text-gray-500 mb-3">Foto (JPG, PNG, WEBP) o PDF — max {MAX_SIZE_MB} MB per file</p>

            {files.length === 0 ? (
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center text-gray-400 cursor-pointer hover:border-purple-400 hover:text-purple-500 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Clicca per caricare foto o PDF</p>
              </div>
            ) : (
              <div className="space-y-2">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 border border-gray-200 rounded-lg p-2 bg-gray-50 group">
                    {/* Preview */}
                    <div className="flex-shrink-0 w-12 h-12 rounded overflow-hidden bg-white border border-gray-200 flex items-center justify-center">
                      {isImage(f) ? (
                        <img src={f.downloadURL} alt={f.name} className="w-full h-full object-cover" />
                      ) : (
                        <FileText size={24} className="text-red-500" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <a
                        href={f.downloadURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-blue-600 hover:underline truncate block"
                      >
                        {f.name}
                      </a>
                      <p className="text-xs text-gray-500">{formatSize(f.size)}</p>
                    </div>

                    {/* Elimina */}
                    <button
                      onClick={() => handleFileRemove(i)}
                      className="flex-shrink-0 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                      title="Elimina file"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                {/* Aggiunta altri file */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg py-2 text-sm text-gray-500 hover:border-purple-400 hover:text-purple-600 transition-colors disabled:opacity-50"
                >
                  + Aggiungi altri file
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 bg-gray-200 text-gray-800 px-4 py-2.5 rounded-lg hover:bg-gray-300 font-medium transition-colors">Annulla</button>
          <button onClick={handleSave} disabled={uploading} className="flex-1 bg-purple-600 text-white px-4 py-2.5 rounded-lg hover:bg-purple-700 font-medium transition-colors disabled:opacity-50">
            {kit ? 'Salva' : 'Crea'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default KitModal;
