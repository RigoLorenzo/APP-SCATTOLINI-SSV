import { useState } from 'react';
import { AlertCircle, Upload, FileText, Eye, Trash2 } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../../firebase';
import { useUser } from '../../contexts/UserContext';
import { useNotification } from '../../contexts/NotificationContext';
import { validateVehicle } from '../../utils/validationUtils';
import { validateFile } from '../../constants/fileConfig';
import Modal from '../Common/Modal';
import { COLLAUDO_OPTIONS, formatCollaudoField } from '../../utils/collaudoUtils';
import { formatRitiroField } from '../../utils/ritiroUtils';

const VehicleModal = ({ vehicle, onClose, onSave, onDelete }) => {
  const { isReadOnly, isAdmin } = useUser();
  const { showToast, showConfirm } = useNotification();
  const getInitialState = () => {
    if (!vehicle) {
      return {
        status: 'da-allestire', note: '', dataArrivo: '',
        dataConsegna: '', modalitaConsegna: '',
        dataRitiro: '', modalitaRitiro: 'ritiro', tipoConsegna: 'bisarca',
        statoRitiro: 'da-pianificare',
        oraMontaggio: '', indirizzoConsegna: '', ritiroSvolto: false, noteRitiro: '',
        tipoAllestimento: '', numeroTelaio: '', targa: '', chiaviDoppioParcheggio: '', committente: '',
        codiceInventario: '', matricolaGruppoFrigo: '',
        ordineSAP: '', numeroMatricola: '', numeroMatricolaLiderkit: '', matricolaLiderkitRicevuta: false, weekSpedizioneKit: '',
        codiceAllestimento: '', descrizioneAllestimento: '', codiceAllestimentoSAP: '',
        descrizioneAllestimentoSAP: '', dataMontaggio: '', omologazioneCollaudo: '',
        collaudo: 'da-collaudare', clienteAvvisato: { si: false, data: '' },
        ritiroGiorno: '', cocFase1: '', cocMandato: false, pagamentoDocumenti: false,
        notePagamento: '', posizioneParcheggio: '',
        conSpondaCaricatrice: false, marcaSponda: '', matricolaSponda: '',
        numeroBollaConsegna: '', non: '', nomeDealer: '', codiceDealer: '',
        codiceFord: '', codiceSCV: '', notePrezzo: '', ddtOkOkFgerace: '',
        distinta: null,
        files: []
      };
    }
    return {
      ...vehicle,
      collaudo: vehicle.collaudo || 'da-collaudare',
      clienteAvvisato: vehicle.clienteAvvisato || { si: false, data: '' },
      files: vehicle.files || []
    };
  };

  const [formData, setFormData] = useState(getInitialState());
  const [uploading, setUploading] = useState(false);
  const [uploadingDistinta, setUploadingDistinta] = useState(false);
  const [activeTab, setActiveTab] = useState('generale');
  const [validationErrors, setValidationErrors] = useState([]);

  const requiresCodiceInventario = formData.tipoAllestimento === 'box' || formData.tipoAllestimento === 'isotermico';

  const handleSave = async () => {
    const validation = validateVehicle(formData);

    const additionalErrors = [];
    if (!formData.tipoAllestimento) {
      additionalErrors.push('Il campo "Tipo Allestimento" è obbligatorio');
    }
    const allErrors = [...validation.errors, ...additionalErrors];

    if (allErrors.length > 0) {
      setValidationErrors(allErrors);
      setActiveTab('generale');
      return;
    }

    if (uploading || uploadingDistinta) {
      showToast('Attendi il caricamento dei file.', 'info');
      return;
    }

    setValidationErrors([]);
    onSave(formData);
  };

  const handleFileAdd = async (e) => {
    const newFiles = Array.from(e.target.files);
    if (newFiles.length === 0) return;
    const validFiles = newFiles.filter(f => validateFile(f, showToast));
    if (validFiles.length === 0) { e.target.value = ''; return; }
    setUploading(true);
    try {
      const uploadPromises = validFiles.map(async (file) => {
        try {
          const timestamp = Date.now();
          const randomStr = Math.random().toString(36).substring(2, 15);
          const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
          const fileName = `${timestamp}_${randomStr}_${safeFileName}`;
          const storageRef = ref(storage, `veicoli/${fileName}`);
          const snapshot = await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(snapshot.ref);
          return { name: file.name, size: file.size, storagePath: `veicoli/${fileName}`, downloadURL, uploadedAt: new Date().toISOString() };
        } catch (error) {
          console.error('Errore upload:', error);
          return null;
        }
      });
      const uploadedFiles = (await Promise.all(uploadPromises)).filter(f => f !== null);
      if (uploadedFiles.length > 0) {
        setFormData(prev => ({ ...prev, files: [...(prev.files || []), ...uploadedFiles] }));
      }
    } catch (error) {
      console.error('Errore:', error);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleFileRemove = async (index) => {
    const fileToRemove = formData.files[index];
    if (!await showConfirm(`Eliminare "${fileToRemove.name}"?`)) return;
    try {
      if (fileToRemove.storagePath) {
        const fileRef = ref(storage, fileToRemove.storagePath);
        await deleteObject(fileRef);
      }
    } catch (error) {
      // Vedi commento in handleDistintaRemove: un file già assente su
      // Storage non deve impedire la rimozione del riferimento in elenco.
      if (error.code !== 'storage/object-not-found') {
        console.error('Errore:', error);
        showToast('Errore durante l\'eliminazione del file', 'error');
        return;
      }
    }
    setFormData(prev => ({ ...prev, files: prev.files.filter((_, i) => i !== index) }));
  };

  const handleDistintaUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingDistinta(true);
    try {
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 15);
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${timestamp}_${randomStr}_${safeFileName}`;
      const storageRef = ref(storage, `veicoli/${fileName}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      setFormData(prev => ({
        ...prev,
        distinta: { name: file.name, size: file.size, storagePath: `veicoli/${fileName}`, downloadURL, uploadedAt: new Date().toISOString() }
      }));
    } catch (error) {
      console.error('Errore upload distinta:', error);
      showToast('Errore durante il caricamento della distinta', 'error');
    } finally {
      setUploadingDistinta(false);
      e.target.value = '';
    }
  };

  const handleDistintaRemove = async () => {
    if (!await showConfirm('Eliminare la distinta?')) return;
    try {
      if (formData.distinta?.storagePath) {
        const fileRef = ref(storage, formData.distinta.storagePath);
        await deleteObject(fileRef);
      }
    } catch (error) {
      // Un file già assente su Storage (es. cancellato altrove, o path
      // legacy non più valido) non deve bloccare la rimozione del
      // riferimento: altrimenti la distinta resta agganciata al veicolo
      // per sempre, impedendo di caricarne una nuova.
      if (error.code !== 'storage/object-not-found') {
        console.error('Errore:', error);
        showToast('Errore durante l\'eliminazione della distinta', 'error');
        return;
      }
    }
    setFormData(prev => ({ ...prev, distinta: null }));
  };

  return (
    <Modal
      title={<h2 className="text-xl md:text-2xl font-bold">{vehicle ? 'Modifica' : 'Nuovo'} Veicolo</h2>}
      onClose={onClose}
      headerClassName="sticky top-0 z-10"
      size="6xl"
      className="my-8"
      overlayClassName="bg-black bg-opacity-50 overflow-y-auto"
      bodyClassName=""
      footer={
        <>
          <button onClick={onClose} className="flex-1 bg-gray-200 text-gray-800 px-4 py-3 rounded-lg hover:bg-gray-300 font-medium">{isReadOnly ? 'Chiudi' : 'Annulla'}</button>
          {!isReadOnly && (
            <button onClick={handleSave} disabled={uploading || uploadingDistinta} className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">{(uploading || uploadingDistinta) ? 'Caricamento...' : (vehicle ? 'Salva' : 'Crea')}</button>
          )}
        </>
      }
      footerClassName="sticky bottom-0 bg-white border-t"
    >
        <div className="border-b bg-gray-50 px-4">
          <div className="flex gap-2 overflow-x-auto">
            {['generale', 'allestimento', ...(formData.tipoAllestimento === 'box' || formData.tipoAllestimento === 'isotermico' ? ['liderkit'] : []), 'ritiri', 'documenti', ...(isAdmin ? ['admin'] : [])].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 font-medium transition-colors whitespace-nowrap ${
                  activeTab === tab ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                {tab === 'generale' && 'Generale'}
                {tab === 'allestimento' && 'Allestimento'}
                {tab === 'liderkit' && 'Liderkit'}
                {tab === 'ritiri' && 'Ritiri & Consegne'}
                {tab === 'documenti' && `Documenti & File (${formData.files?.length || 0})`}
                {tab === 'admin' && '🔒 Info Ford'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 md:p-6 max-h-[calc(90vh-12rem)] overflow-y-auto">
          {activeTab === 'generale' && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg mb-3">Informazioni Generali</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Committente *</label><input type="text" className="w-full border border-gray-300 rounded px-3 py-2 bg-red-50" value={formData.committente || ''} onChange={(e) => setFormData({ ...formData, committente: e.target.value })} /></div>
                <div><label className="block text-sm font-medium mb-1">Data Consegna *</label><input type="date" className="w-full border border-gray-300 rounded px-3 py-2 bg-red-50" value={formData.dataConsegna || ''} onChange={(e) => setFormData({ ...formData, dataConsegna: e.target.value })} /></div>
                <div><label className="block text-sm font-medium mb-1">Data Arrivo</label><input type="date" className="w-full border border-gray-300 rounded px-3 py-2" value={formData.dataArrivo || ''} onChange={(e) => setFormData({ ...formData, dataArrivo: e.target.value })} /></div>

                <div><label className="block text-sm font-medium mb-1">Numero Telaio</label><input type="text" className="w-full border border-gray-300 rounded px-3 py-2" value={formData.numeroTelaio || ''} onChange={(e) => setFormData({ ...formData, numeroTelaio: e.target.value })} /></div>
                <div><label className="block text-sm font-medium mb-1">Targa</label><input type="text" className="w-full border border-gray-300 rounded px-3 py-2" value={formData.targa || ''} onChange={(e) => setFormData({ ...formData, targa: e.target.value })} placeholder="Assegnata dopo l'immatricolazione" /></div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status *</label>
                  <select className="w-full border border-gray-300 rounded px-3 py-2 bg-red-50" value={formData.status || 'da-allestire'} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                    <option value="da-allestire">Da Allestire</option>
                    <option value="in-allestimento">In Allestimento</option>
                    <option value="pronto">Pronto</option>
                    <option value="ritirato">Ritirato</option>
                  </select>
                </div>
                <div><label className="block text-sm font-medium mb-1">Chiavi parcheggio</label><input type="text" className="w-full border border-gray-300 rounded px-3 py-2" value={formData.chiaviDoppioParcheggio || ''} onChange={(e) => setFormData({ ...formData, chiaviDoppioParcheggio: e.target.value })} /></div>
                <div><label className="block text-sm font-medium mb-1">Posizione Parcheggio</label><input type="text" className="w-full border border-gray-300 rounded px-3 py-2" value={formData.posizioneParcheggio || ''} onChange={(e) => setFormData({ ...formData, posizioneParcheggio: e.target.value })} placeholder="es. A12" /></div>
                <div><label className="block text-sm font-medium mb-1">Ordine SAP</label><input type="text" className="w-full border border-gray-300 rounded px-3 py-2" value={formData.ordineSAP || ''} onChange={(e) => setFormData({ ...formData, ordineSAP: e.target.value })} /></div>
                <div><label className="block text-sm font-medium mb-1">Numero Matricola</label><input type="text" className="w-full border border-gray-300 rounded px-3 py-2" value={formData.numeroMatricola || ''} onChange={(e) => setFormData({ ...formData, numeroMatricola: e.target.value })} /></div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="font-semibold mb-3">Collaudo</h4>
                <div className="flex flex-wrap gap-4 items-end">
                  <div className="w-full max-w-xs">
                    <label className="block text-sm font-medium mb-1">Stato Collaudo</label>
                    <select className="w-full border border-gray-300 rounded px-3 py-2" value={formData.collaudo || 'da-collaudare'} onChange={(e) => setFormData({ ...formData, collaudo: e.target.value })}>
                      {COLLAUDO_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  {['da-collaudare', 'pianificato'].includes(formData.collaudo || 'da-collaudare') && (
                    <div className="w-full max-w-xs">
                      <label className="block text-sm font-medium mb-1">Data Collaudo</label>
                      <input type="date" className="w-full border border-gray-300 rounded px-3 py-2" value={formData.dataCollaudo || ''} onChange={(e) => setFormData({ ...formData, dataCollaudo: e.target.value })} disabled={isReadOnly} />
                    </div>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-2">{formatCollaudoField(formData)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Descrizione Allestimento</label>
                <input type="text" className="w-full border border-gray-300 rounded px-3 py-2" value={formData.descrizioneAllestimento || ''} onChange={(e) => setFormData({ ...formData, descrizioneAllestimento: e.target.value })} placeholder="Descrizione sintetica dell'allestimento" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Note Generali</label>
                <textarea className="w-full border border-gray-300 rounded px-3 py-2" rows="4" value={formData.note || ''} onChange={(e) => setFormData({ ...formData, note: e.target.value })} />
              </div>

              {!isReadOnly && vehicle && onDelete && (
                <div className="border border-red-200 rounded-lg p-4 mt-2 bg-red-50">
                  <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Zona pericolosa</p>
                  <p className="text-xs text-red-600 mb-3">L'eliminazione è permanente e non può essere annullata.</p>
                  <button
                    type="button"
                    onClick={onDelete}
                    className="text-sm border border-red-400 text-red-600 px-3 py-1.5 rounded hover:bg-red-100 transition-colors flex items-center gap-2"
                  >
                    <Trash2 size={14} />
                    Elimina veicolo
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'allestimento' && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg mb-3">Dettagli Allestimento</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Tipo Allestimento *</label>
                  <select className="w-full border border-gray-300 rounded px-3 py-2 bg-red-50" value={formData.tipoAllestimento || ''} onChange={(e) => setFormData({ ...formData, tipoAllestimento: e.target.value })}>
                    <option value="">Seleziona...</option>
                    <option value="box">Box</option>
                    <option value="isotermico">Isotermico</option>
                    <option value="cassone-fisso">Cassone Fisso</option>
                    <option value="cassone-ribaltabile">Cassone Ribaltabile</option>
                  </select>
                </div>

                <div><label className="block text-sm font-medium mb-1">Data Montaggio</label><input type="date" className="w-full border border-gray-300 rounded px-3 py-2" value={formData.dataMontaggio || ''} onChange={(e) => setFormData({ ...formData, dataMontaggio: e.target.value })} /></div>
                <div><label className="block text-sm font-medium mb-1">Codice Allestimento SAP</label><input type="text" className="w-full border border-gray-300 rounded px-3 py-2" value={formData.codiceAllestimentoSAP || ''} onChange={(e) => setFormData({ ...formData, codiceAllestimentoSAP: e.target.value })} /></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">Descrizione Allestimento</label><textarea className="w-full border border-gray-300 rounded px-3 py-2" rows="2" value={formData.descrizioneAllestimento || ''} onChange={(e) => setFormData({ ...formData, descrizioneAllestimento: e.target.value })} /></div>

              {formData.tipoAllestimento === 'isotermico' && (
                <div className="col-span-1 md:col-span-2 border-t pt-4">
                  <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 max-w-xs">
                    <label className="block text-sm font-medium mb-1">Matr. Gruppo Frigo</label>
                    <input type="text" className="w-full border border-gray-300 rounded px-3 py-2" value={formData.matricolaGruppoFrigo || ''} onChange={(e) => setFormData({ ...formData, matricolaGruppoFrigo: e.target.value })} placeholder="Numero di matricola gruppo frigo" />
                  </div>
                </div>
              )}

              {formData.tipoAllestimento === 'box' && (
                <div className="col-span-1 md:col-span-2 border-t pt-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.conSpondaCaricatrice || false}
                        onChange={(e) => setFormData({
                          ...formData,
                          conSpondaCaricatrice: e.target.checked,
                          ...(e.target.checked ? {} : { marcaSponda: '', matricolaSponda: '' })
                        })}
                        className="w-5 h-5 accent-amber-600"
                      />
                      <span className="font-semibold text-amber-900">Con sponda caricatrice</span>
                    </label>
                    {formData.conSpondaCaricatrice && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Marca sponda</label>
                          <input type="text" className="w-full border border-gray-300 rounded px-3 py-2" value={formData.marcaSponda || ''} onChange={(e) => setFormData({ ...formData, marcaSponda: e.target.value })} placeholder="es. Bär, Zepro, Dhollandia" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Matricola sponda</label>
                          <input type="text" className="w-full border border-gray-300 rounded px-3 py-2" value={formData.matricolaSponda || ''} onChange={(e) => setFormData({ ...formData, matricolaSponda: e.target.value })} placeholder="Numero di matricola" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {requiresCodiceInventario && (
                <div className="border-t pt-4">
                  <div className="mb-4 max-w-xs">
                    <label className="block text-sm font-medium mb-1">Codice Inventario</label>
                    <input type="text" className="w-full border border-gray-300 rounded px-3 py-2" value={formData.codiceInventario || ''} onChange={(e) => setFormData({ ...formData, codiceInventario: e.target.value })} placeholder="es. INV-2026-001" />
                  </div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText size={16} className="text-blue-600" />
                    Distinta
                  </h4>
                  {formData.distinta ? (
                    <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <FileText size={20} className="text-blue-600 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{formData.distinta.name}</p>
                          <p className="text-xs text-gray-500">
                            {formData.distinta.size ? `${(formData.distinta.size / 1024).toFixed(1)} KB` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {formData.distinta.downloadURL && (
                          <a href={formData.distinta.downloadURL} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-600 hover:bg-blue-100 rounded">
                            <Eye size={18} />
                          </a>
                        )}
                        {!isReadOnly && (
                          <button onClick={handleDistintaRemove} className="p-2 text-red-600 hover:bg-red-50 rounded">
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    !isReadOnly && (
                      <div className="border-2 border-dashed border-blue-200 rounded-lg p-4 text-center bg-blue-50">
                        <Upload size={32} className="mx-auto mb-2 text-blue-400" />
                        <label className="cursor-pointer">
                          <span className="text-blue-600 hover:text-blue-700 font-medium text-sm">Carica distinta</span>
                          <input type="file" onChange={handleDistintaUpload} disabled={uploadingDistinta} className="hidden" />
                        </label>
                        <p className="text-xs text-gray-500 mt-1">PDF, immagini, documenti</p>
                        {uploadingDistinta && (
                          <div className="mt-2 flex items-center justify-center gap-2 text-blue-600">
                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm">Caricamento...</span>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'liderkit' && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg mb-3">Informazioni Liderkit</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Numero Matricola Liderkit</label>
                  <div className="flex items-center gap-3">
                    <input type="text" className="w-full border border-gray-300 rounded px-3 py-2" value={formData.numeroMatricolaLiderkit || ''} onChange={(e) => setFormData({ ...formData, numeroMatricolaLiderkit: e.target.value })} />
                    <label className="flex items-center gap-1.5 cursor-pointer select-none whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={formData.matricolaLiderkitRicevuta || false}
                        onChange={(e) => setFormData({ ...formData, matricolaLiderkitRicevuta: e.target.checked })}
                        className="w-5 h-5 accent-orange-600"
                        disabled={isReadOnly}
                      />
                      <span className={`text-sm font-medium ${formData.matricolaLiderkitRicevuta ? 'text-orange-700' : 'text-gray-500'}`}>
                        Ricevuto
                      </span>
                    </label>
                  </div>
                </div>
                <div><label className="block text-sm font-medium mb-1">Week Spedizione Kit</label><input type="text" className="w-full border border-gray-300 rounded px-3 py-2" value={formData.weekSpedizioneKit || ''} onChange={(e) => setFormData({ ...formData, weekSpedizioneKit: e.target.value })} /></div>
              </div>
            </div>
          )}

          {activeTab === 'ritiri' && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg mb-3">Ritiri & Consegne</h3>
              <p className="text-sm text-gray-600">{formatRitiroField(formData)}</p>

              {/* Modalità */}
              <div>
                <label className="block text-sm font-semibold mb-2">Modalità</label>
                <div className="flex flex-wrap gap-3">
                  {[
                    { value: 'ritiro', label: '📦 Ritiro del Mezzo' },
                    { value: 'consegna', label: '🚗 Consegna' },
                    { value: 'montaggio', label: '🔧 Appuntamento Montaggio' },
                  ].map(opt => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer border rounded-lg px-3 py-2 hover:bg-gray-50">
                      <input
                        type="radio"
                        name="modalitaRitiro"
                        value={opt.value}
                        checked={(formData.modalitaRitiro || 'ritiro') === opt.value}
                        onChange={(e) => setFormData({ ...formData, modalitaRitiro: e.target.value })}
                        disabled={isReadOnly}
                      />
                      <span className="text-sm font-medium">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Data Ritiro / Appuntamento */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {formData.modalitaRitiro === 'montaggio' ? 'Data Appuntamento Montaggio' : 'Data Ritiro / Consegna'}
                  </label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    value={formData.dataRitiro || ''}
                    onChange={(e) => setFormData({ ...formData, dataRitiro: e.target.value })}
                    disabled={isReadOnly}
                  />
                </div>

                {/* Giorno Ritiro */}
                <div>
                  <label className="block text-sm font-medium mb-1">Giorno Ritiro</label>
                  <select
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    value={formData.ritiroGiorno || ''}
                    onChange={(e) => setFormData({ ...formData, ritiroGiorno: e.target.value })}
                    disabled={isReadOnly}
                  >
                    <option value="">Seleziona...</option>
                    <option value="Lunedì">Lunedì</option>
                    <option value="Martedì">Martedì</option>
                    <option value="Mercoledì">Mercoledì</option>
                    <option value="Giovedì">Giovedì</option>
                    <option value="Venerdì">Venerdì</option>
                    <option value="Sabato">Sabato</option>
                  </select>
                </div>

                {/* Ora Montaggio — solo per modalità montaggio */}
                {formData.modalitaRitiro === 'montaggio' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Ora Montaggio</label>
                    <input
                      type="time"
                      className="w-full border border-purple-300 rounded px-3 py-2 focus:border-purple-500"
                      value={formData.oraMontaggio || ''}
                      onChange={(e) => setFormData({ ...formData, oraMontaggio: e.target.value })}
                      disabled={isReadOnly}
                    />
                  </div>
                )}

                {/* Tipo Consegna — solo per modalità consegna */}
                {formData.modalitaRitiro === 'consegna' && (
                  <div>
                    <label className="block text-sm font-medium mb-1">Tipo Consegna</label>
                    <select
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      value={formData.tipoConsegna || 'bisarca'}
                      onChange={(e) => setFormData({ ...formData, tipoConsegna: e.target.value })}
                      disabled={isReadOnly}
                    >
                      <option value="bisarca">🚛 Bisarca</option>
                      <option value="driver">🚗 Driver</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Indirizzo Consegna e Modalità Consegna — solo per modalità consegna */}
              {formData.modalitaRitiro === 'consegna' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Indirizzo Consegna</label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      value={formData.indirizzoConsegna || ''}
                      onChange={(e) => setFormData({ ...formData, indirizzoConsegna: e.target.value })}
                      disabled={isReadOnly}
                      placeholder="Via, Città..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Modalità Consegna</label>
                    <input
                      type="text"
                      className="w-full border border-gray-300 rounded px-3 py-2"
                      value={formData.modalitaConsegna || ''}
                      onChange={(e) => setFormData({ ...formData, modalitaConsegna: e.target.value })}
                      disabled={isReadOnly}
                      placeholder="Note su come avviene la consegna"
                    />
                  </div>
                </div>
              )}

              {/* Cliente Avvisato */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.clienteAvvisato?.si || false}
                    onChange={(e) => setFormData({
                      ...formData,
                      clienteAvvisato: { ...formData.clienteAvvisato, si: e.target.checked, data: e.target.checked ? (formData.clienteAvvisato?.data || '') : '' }
                    })}
                    className="w-5 h-5"
                    disabled={isReadOnly}
                  />
                  <span className="font-medium">Cliente Avvisato</span>
                </label>
                {formData.clienteAvvisato?.si && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium mb-1">Data avviso</label>
                    <input
                      type="date"
                      className="w-full border border-gray-300 rounded px-3 py-2 max-w-xs"
                      value={formData.clienteAvvisato?.data || ''}
                      onChange={(e) => setFormData({ ...formData, clienteAvvisato: { ...formData.clienteAvvisato, data: e.target.value } })}
                      disabled={isReadOnly}
                    />
                  </div>
                )}
              </div>

              {/* Ritiro Svolto */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.ritiroSvolto || false}
                    onChange={(e) => setFormData({ ...formData, ritiroSvolto: e.target.checked })}
                    className="w-5 h-5 accent-green-600"
                    disabled={isReadOnly}
                  />
                  <span className="font-medium">
                    {formData.modalitaRitiro === 'montaggio' ? 'Appuntamento Montaggio Completato' : 'Ritiro / Consegna Svolto'}
                  </span>
                </label>
              </div>

              {/* Note Ritiro */}
              <div>
                <label className="block text-sm font-medium mb-1">Note Ritiro</label>
                <textarea
                  className="w-full border border-gray-300 rounded px-3 py-2"
                  rows="3"
                  value={formData.noteRitiro || ''}
                  onChange={(e) => setFormData({ ...formData, noteRitiro: e.target.value })}
                  disabled={isReadOnly}
                />
              </div>
            </div>
          )}

          {activeTab === 'documenti' && (
            <div className="space-y-4">
              <h3 className="font-bold text-lg mb-3">Documenti</h3>
              <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
                <h4 className="font-semibold mb-3">Pagamento Documenti</h4>
                <label className="flex items-center gap-3">
                  <input type="checkbox" checked={formData.pagamentoDocumenti || false} onChange={(e) => setFormData({ ...formData, pagamentoDocumenti: e.target.checked })} className="w-6 h-6" />
                  <span className="text-base font-medium">Documenti Pagati</span>
                </label>
                {formData.pagamentoDocumenti && (
                  <div className="mt-3">
                    <label className="block text-sm font-medium mb-1">Note Pagamento</label>
                    <textarea className="w-full border border-gray-300 rounded px-3 py-2" rows="2" value={formData.notePagamento || ''} onChange={(e) => setFormData({ ...formData, notePagamento: e.target.value })} />
                  </div>
                )}
              </div>
              <div className="border-2 border-blue-200 rounded-lg p-4 bg-blue-50">
                <h4 className="font-semibold mb-3 text-blue-900">COC (Certificato di Conformità)</h4>
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={formData.cocMandato || false}
                    onChange={(e) => setFormData({ ...formData, cocMandato: e.target.checked })}
                    className="w-6 h-6 accent-blue-600"
                    disabled={isReadOnly}
                  />
                  <span className={`text-base font-medium ${formData.cocMandato ? 'text-blue-800' : 'text-gray-700'}`}>
                    {formData.cocMandato ? '✅ COC Ricevuto' : 'COC non ancora ricevuto'}
                  </span>
                </label>
                <div className="mt-3 max-w-xs">
                  <label className="block text-sm font-medium mb-1">COC Fase 1</label>
                  <input type="text" className="w-full border border-gray-300 rounded px-3 py-2" value={formData.cocFase1 || ''} onChange={(e) => setFormData({ ...formData, cocFase1: e.target.value })} disabled={isReadOnly} />
                </div>
              </div>

              <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
                <h4 className="font-semibold mb-3">Stato Documenti</h4>
                <label className="flex items-center gap-3">
                  <input type="checkbox" checked={formData.documentiMandati || false} onChange={(e) => setFormData({ ...formData, documentiMandati: e.target.checked })} className="w-6 h-6" />
                  <span className="text-base font-medium">Documenti Mandati</span>
                </label>
                {formData.documentiMandati && (
                  <div className="mt-3 max-w-xs">
                    <label className="block text-sm font-medium mb-1">Data Spedizione Documenti</label>
                    <input type="date" className="w-full border border-gray-300 rounded px-3 py-2" value={formData.dataSpedizioneDocumenti || ''} onChange={(e) => setFormData({ ...formData, dataSpedizioneDocumenti: e.target.value })} disabled={isReadOnly} />
                  </div>
                )}
              </div>
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Gestione File Allegati</h4>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center bg-gray-50">
                  <Upload size={48} className="mx-auto mb-3 text-gray-400" />
                  <label className="cursor-pointer">
                    <span className="text-blue-600 hover:text-blue-700 font-medium">Clicca per caricare file</span>
                    <input type="file" multiple onChange={handleFileAdd} disabled={uploading} className="hidden" />
                  </label>
                  <p className="text-sm text-gray-500 mt-2">PDF, immagini, documenti</p>
                  {uploading && (
                    <div className="mt-3 flex items-center justify-center gap-2 text-blue-600">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Caricamento...</span>
                    </div>
                  )}
                </div>
                {formData.files && formData.files.length > 0 && (
                  <div className="space-y-2 mt-3">
                    <h4 className="font-semibold">File Caricati ({formData.files.length})</h4>
                    {formData.files.map((file, i) => (
                      <div key={i} className="flex items-center justify-between bg-white border rounded-lg p-3 hover:shadow-md transition-shadow">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <FileText size={20} className="text-blue-600" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{file.name}</p>
                            <p className="text-xs text-gray-500">{file.size ? `${(file.size / 1024).toFixed(1)} KB` : ''}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {file.downloadURL && (
                            <a href={file.downloadURL} target="_blank" rel="noopener noreferrer" className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                              <Eye size={18} />
                            </a>
                          )}
                          <button onClick={() => handleFileRemove(i)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'admin' && isAdmin && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="font-bold text-lg">Info Ford</h3>
                <span className="text-xs bg-yellow-100 text-yellow-800 border border-yellow-300 rounded px-2 py-0.5 font-medium">Solo Admin</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">Numero Bolla Consegna</label><input type="text" className="w-full border border-gray-300 rounded px-3 py-2 bg-yellow-50" value={formData.numeroBollaConsegna || ''} onChange={(e) => setFormData({ ...formData, numeroBollaConsegna: e.target.value })} /></div>
                <div><label className="block text-sm font-medium mb-1">NON</label><input type="text" className="w-full border border-gray-300 rounded px-3 py-2 bg-yellow-50" value={formData.non || ''} onChange={(e) => setFormData({ ...formData, non: e.target.value })} /></div>
                <div><label className="block text-sm font-medium mb-1">Nome Dealer</label><input type="text" className="w-full border border-gray-300 rounded px-3 py-2 bg-yellow-50" value={formData.nomeDealer || ''} onChange={(e) => setFormData({ ...formData, nomeDealer: e.target.value })} /></div>
                <div><label className="block text-sm font-medium mb-1">Codice Dealer</label><input type="text" className="w-full border border-gray-300 rounded px-3 py-2 bg-yellow-50" value={formData.codiceDealer || ''} onChange={(e) => setFormData({ ...formData, codiceDealer: e.target.value })} /></div>
                <div><label className="block text-sm font-medium mb-1">Codice Ford</label><input type="text" className="w-full border border-gray-300 rounded px-3 py-2 bg-yellow-50" value={formData.codiceFord || ''} onChange={(e) => setFormData({ ...formData, codiceFord: e.target.value })} /></div>
                <div><label className="block text-sm font-medium mb-1">Codice SCV</label><input type="text" className="w-full border border-gray-300 rounded px-3 py-2 bg-yellow-50" value={formData.codiceSCV || ''} onChange={(e) => setFormData({ ...formData, codiceSCV: e.target.value })} /></div>
                <div><label className="block text-sm font-medium mb-1">DDT OK OK FGERACE</label><input type="text" className="w-full border border-gray-300 rounded px-3 py-2 bg-yellow-50" value={formData.ddtOkOkFgerace || ''} onChange={(e) => setFormData({ ...formData, ddtOkOkFgerace: e.target.value })} /></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">Note Prezzo</label><textarea className="w-full border border-gray-300 rounded px-3 py-2 bg-yellow-50" rows="2" value={formData.notePrezzo || ''} onChange={(e) => setFormData({ ...formData, notePrezzo: e.target.value })} /></div>
            </div>
          )}
          {validationErrors.length > 0 && (
            <div className="pt-2">
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle size={20} className="text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-bold text-red-900 mb-2">Correggi i seguenti errori:</p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-red-800">
                      {validationErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
    </Modal>
  );
};

export default VehicleModal;
