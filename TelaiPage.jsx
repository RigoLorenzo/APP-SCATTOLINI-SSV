import { useState, useEffect } from 'react';
import { Hash, Plus, Search, Settings, Trash2, FilePlus, X } from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, logAction } from '../firebase';
import { toISO, fmtDMY } from '../utils/dateUtils';
import { useUser } from '../contexts/UserContext';
import { useNotification } from '../contexts/NotificationContext';

// ─────────────────────────────────────────────────────────────────────────────
// Modale aggiungi/modifica telaio in attesa di ordine
// ─────────────────────────────────────────────────────────────────────────────
const TelaioModal = ({ telaio, onClose, onSave }) => {
  const { showToast } = useNotification();
  const [formData, setFormData] = useState(telaio || {
    numeroTelaio: '',
    committente: '',
    chiaviDoppioParcheggio: '',
    note: '',
    dataArrivoVeicolo: toISO(new Date()),
  });

  const handleSave = () => {
    if (!formData.numeroTelaio.trim()) {
      showToast('Il Numero Telaio è obbligatorio.', 'error');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="bg-gradient-to-r from-slate-600 to-slate-700 text-white p-4 flex justify-between items-center rounded-t-lg">
          <h2 className="text-xl font-bold">{telaio ? 'Modifica' : 'Nuovo'} Telaio in Attesa</h2>
          <button onClick={onClose} className="text-white hover:text-slate-200"><X size={24} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Numero Telaio *</label>
            <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-slate-500 focus:ring-2 focus:ring-slate-200" value={formData.numeroTelaio} onChange={(e) => setFormData({ ...formData, numeroTelaio: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Committente</label>
            <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-slate-500 focus:ring-2 focus:ring-slate-200" value={formData.committente || ''} onChange={(e) => setFormData({ ...formData, committente: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Data Arrivo Veicolo</label>
            <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-slate-500 focus:ring-2 focus:ring-slate-200" value={formData.dataArrivoVeicolo || ''} onChange={(e) => setFormData({ ...formData, dataArrivoVeicolo: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Chiavi Parcheggio</label>
            <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-slate-500 focus:ring-2 focus:ring-slate-200" value={formData.chiaviDoppioParcheggio || ''} onChange={(e) => setFormData({ ...formData, chiaviDoppioParcheggio: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Note</label>
            <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-slate-500 focus:ring-2 focus:ring-slate-200" rows="3" value={formData.note || ''} onChange={(e) => setFormData({ ...formData, note: e.target.value })} />
          </div>
        </div>

        <div className="border-t p-4 flex gap-3">
          <button onClick={onClose} className="flex-1 bg-gray-200 text-gray-800 px-4 py-2.5 rounded-lg hover:bg-gray-300 font-medium transition-colors">Annulla</button>
          <button onClick={handleSave} className="flex-1 bg-slate-600 text-white px-4 py-2.5 rounded-lg hover:bg-slate-700 font-medium transition-colors">
            {telaio ? 'Salva' : 'Crea'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Modale di conversione Telaio → Scheda Veicolo
// ─────────────────────────────────────────────────────────────────────────────
const ConvertToVehicleModal = ({ telaio, userName, onClose, onConverted }) => {
  const { showToast } = useNotification();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    committente: telaio.committente || '',
    dataConsegna: '',
    tipoAllestimento: '',
  });

  const tipoOptions = [
    { value: 'box',                label: 'Box' },
    { value: 'isotermico',         label: 'Isotermico' },
    { value: 'cassone-fisso',      label: 'Cassone Fisso' },
    { value: 'cassone-ribaltabile',label: 'Cassone Ribaltabile' },
  ];

  const handleSubmit = async () => {
    if (!form.committente.trim() || !form.dataConsegna || !form.tipoAllestimento) {
      showToast('Compila tutti i campi obbligatori.', 'error');
      return;
    }
    setSaving(true);
    try {
      const vehicleData = {
        // Obbligatori
        committente:            form.committente.trim(),
        dataConsegna:           form.dataConsegna,
        tipoAllestimento:       form.tipoAllestimento,
        // Mappati dal telaio in attesa
        numeroTelaio:           telaio.numeroTelaio || '',
        chiaviDoppioParcheggio: telaio.chiaviDoppioParcheggio || '',
        note:                   telaio.note || '',
        // Stato iniziale
        status:                 'da-allestire',
        dataArrivo:             telaio.dataArrivoVeicolo || toISO(new Date()),
        // Tutti gli altri campi a default
        targa:                  '',
        dataMontaggio:          '',
        modalitaConsegna:       '',
        posizioneParcheggio:    '',
        ordineSAP:              '',
        numeroMatricola:        '',
        numeroMatricolaLiderkit: '',
        matricolaLiderkitRicevuta: false,
        weekSpedizioneKit:      '',
        matricolaGruppoFrigo:   '',
        codiceAllestimento:     '',
        descrizioneAllestimento: '',
        codiceAllestimentoSAP:  '',
        descrizioneAllestimentoSAP: '',
        omologazioneCollaudo:   '',
        codiceInventario:       '',
        collaudo:               'da-collaudare',
        dataCollaudo:           '',
        clienteAvvisato:        { si: false, data: '' },
        ritiroGiorno:           '',
        cocFase1:               '',
        pagamentoDocumenti:     false,
        notePagamento:          '',
        files:                  [],
        conSpondaCaricatrice:   false,
        marcaSponda:            '',
        matricolaSponda:        '',
        documentiMandati:       false,
        dataSpedizioneDocumenti:'',
        dataRitiro:             '',
        modalitaRitiro:         'ritiro',
        tipoConsegna:           'bisarca',
        oraMontaggio:           '',
        indirizzoConsegna:      '',
        ritiroSvolto:           false,
        noteRitiro:             '',
        numeroBollaConsegna:    '',
        non:                    '',
        nomeDealer:             '',
        codiceDealer:           '',
        codiceFord:             '',
        codiceSCV:              '',
        notePrezzo:             '',
        ddtOkOkFgerace:         '',
      };

      await addDoc(collection(db, 'veicoli'), vehicleData);
      await logAction(userName, 'Creazione Veicolo da Telaio in Attesa', {
        committente:  form.committente,
        numeroTelaio: telaio.numeroTelaio,
      });

      // Il telaio si è trasformato nella scheda veicolo appena creata: non ha
      // più senso tenerlo anche nell'elenco "in attesa di ordine".
      await deleteDoc(doc(db, 'telai', telaio.id));
      await logAction(userName, 'Telaio rimosso dall\'attesa ordine (convertito in veicolo)', {
        numeroTelaio: telaio.numeroTelaio,
      });

      onConverted();
    } catch (err) {
      console.error('Errore conversione telaio:', err);
      showToast('Errore durante la creazione della scheda veicolo.', 'error');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">

        <div className="bg-gradient-to-r from-green-600 to-green-700 text-white p-4 flex justify-between items-center rounded-t-lg">
          <div className="flex items-center gap-2">
            <FilePlus size={20} />
            <h2 className="text-lg font-bold">Crea Scheda Veicolo</h2>
          </div>
          <button onClick={onClose} className="text-white hover:text-green-200 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-5">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-5">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
              Telaio selezionato
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div>
                <span className="text-gray-500">N° Telaio: </span>
                <span className="font-semibold font-mono">{telaio.numeroTelaio}</span>
              </div>
              {telaio.committente && (
                <div>
                  <span className="text-gray-500">Committente: </span>
                  <span className="font-semibold">{telaio.committente}</span>
                </div>
              )}
              {telaio.dataArrivoVeicolo && (
                <div>
                  <span className="text-gray-500">Data Arrivo: </span>
                  <span className="font-semibold">{fmtDMY(telaio.dataArrivoVeicolo)}</span>
                </div>
              )}
              {telaio.chiaviDoppioParcheggio && (
                <div>
                  <span className="text-gray-500">Chiavi Parcheggio: </span>
                  <span className="font-semibold">{telaio.chiaviDoppioParcheggio}</span>
                </div>
              )}
              {telaio.note && (
                <div className="col-span-2">
                  <span className="text-gray-500">Note: </span>
                  <span>{telaio.note}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-5 text-xs text-green-800">
            <p className="font-semibold mb-1">Campi compilati automaticamente:</p>
            <ul className="space-y-0.5">
              <li>• <strong>N° Telaio</strong> ← {telaio.numeroTelaio}</li>
              {telaio.dataArrivoVeicolo && <li>• <strong>Data Arrivo</strong> ← {fmtDMY(telaio.dataArrivoVeicolo)}</li>}
              {telaio.chiaviDoppioParcheggio && <li>• <strong>Chiavi Parcheggio</strong> ← {telaio.chiaviDoppioParcheggio}</li>}
              {telaio.note && <li>• <strong>Note</strong> ← {telaio.note}</li>}
            </ul>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Committente <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-green-500 focus:ring-2 focus:ring-green-200"
                placeholder="Nome committente / cliente"
                value={form.committente}
                onChange={(e) => setForm({ ...form, committente: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Data Consegna <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-green-500 focus:ring-2 focus:ring-green-200"
                value={form.dataConsegna}
                onChange={(e) => setForm({ ...form, dataConsegna: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Tipo Allestimento <span className="text-red-500">*</span>
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-green-500 focus:ring-2 focus:ring-green-200"
                value={form.tipoAllestimento}
                onChange={(e) => setForm({ ...form, tipoAllestimento: e.target.value })}
              >
                <option value="">Seleziona...</option>
                {tipoOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <p className="text-xs text-gray-500 pt-1">
              Il telaio verrà rimosso automaticamente dall'elenco "in attesa di ordine" una volta creata la scheda veicolo.
            </p>
          </div>
        </div>

        <div className="border-t p-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-gray-200 text-gray-800 px-4 py-2.5 rounded-lg hover:bg-gray-300 font-medium transition-colors"
          >
            Annulla
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex-1 bg-green-600 text-white px-4 py-2.5 rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <FilePlus size={16} />
            {saving ? 'Creazione...' : 'Crea Scheda Veicolo'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Pagina principale
// ─────────────────────────────────────────────────────────────────────────────
const TelaiPage = ({ userName }) => {
  const { isReadOnly } = useUser();
  const { showToast, showConfirm } = useNotification();
  const [telai, setTelai] = useState([]);
  const [showTelaioModal, setShowTelaioModal] = useState(false);
  const [editingTelaio, setEditingTelaio] = useState(null);
  const [convertingTelaio, setConvertingTelaio] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'telai'), orderBy('dataArrivoVeicolo', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTelai(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error('telai listener error:', error);
      showToast('Errore caricamento telai in attesa di ordine.', 'error');
    });
    return unsubscribe;
  }, []);

  const handleAddTelaio = () => {
    setEditingTelaio(null);
    setShowTelaioModal(true);
  };

  const handleEditTelaio = (telaio) => {
    setEditingTelaio(telaio);
    setShowTelaioModal(true);
  };

  const handleSaveTelaio = async (telaioData) => {
    try {
      if (editingTelaio) {
        await updateDoc(doc(db, 'telai', editingTelaio.id), telaioData);
        await logAction(userName, 'Modifica Telaio in Attesa', { numeroTelaio: telaioData.numeroTelaio, committente: telaioData.committente });
      } else {
        await addDoc(collection(db, 'telai'), telaioData);
        await logAction(userName, 'Aggiunta Telaio in Attesa', { numeroTelaio: telaioData.numeroTelaio, committente: telaioData.committente });
      }
      setShowTelaioModal(false);
    } catch (error) {
      console.error('Errore:', error);
      showToast('Errore durante il salvataggio.', 'error');
    }
  };

  const handleDeleteTelaio = async (telaio) => {
    if (!await showConfirm('Eliminare questo telaio in attesa di ordine?')) return;
    try {
      await deleteDoc(doc(db, 'telai', telaio.id));
      await logAction(userName, 'Eliminazione Telaio in Attesa', { numeroTelaio: telaio.numeroTelaio, committente: telaio.committente });
    } catch (error) {
      console.error('Errore:', error);
      showToast('Errore durante l\'eliminazione.', 'error');
    }
  };

  const handleConverted = () => {
    setConvertingTelaio(null);
    showToast('Scheda veicolo creata e telaio rimosso dall\'elenco.', 'success');
  };

  const filteredTelai = telai.filter(t =>
    t.numeroTelaio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.committente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.note?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Telai in Attesa di Ordine</h2>
          <p className="text-sm text-gray-600 mt-1">{telai.length} telai in attesa</p>
        </div>
        <div className="flex gap-2">
          {!isReadOnly && (
            <button
              onClick={handleAddTelaio}
              className="bg-slate-600 text-white px-4 py-2 rounded-lg hover:bg-slate-700 transition-colors flex items-center gap-2"
            >
              <Plus size={18} />
              Nuovo Telaio
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Search size={20} className="text-gray-400" />
          <input
            type="text"
            placeholder="Cerca per telaio, committente o note..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {filteredTelai.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Hash size={64} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg">Nessun telaio in attesa di ordine</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredTelai.map(telaio => (
              <div key={telaio.id} className="bg-white rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-slate-500 hover:shadow-md transition-all">
                <div className="px-3 py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                    <div>
                      <p className="text-gray-400 text-[10px] uppercase">N° Telaio</p>
                      <p className="font-semibold text-slate-700 font-mono truncate">{telaio.numeroTelaio || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-[10px] uppercase tracking-wide">Committente</p>
                      <p className="font-bold text-gray-900 truncate text-sm">{telaio.committente || '-'}</p>
                    </div>
                    <div className="hidden md:block">
                      <p className="text-gray-400 text-[10px] uppercase">Data Arrivo Veicolo</p>
                      <p className="font-semibold text-gray-700 truncate">{fmtDMY(telaio.dataArrivoVeicolo) || '-'}</p>
                    </div>
                    <div className="hidden md:block">
                      <p className="text-gray-400 text-[10px] uppercase">Chiavi Parcheggio</p>
                      <p className="font-semibold text-gray-700 truncate">{telaio.chiaviDoppioParcheggio || '-'}</p>
                    </div>
                    <div className="hidden md:block">
                      <p className="text-gray-400 text-[10px] uppercase">Note</p>
                      <p className="text-gray-600 truncate">{telaio.note || '-'}</p>
                    </div>
                  </div>

                  <div className="flex-shrink-0 flex items-center gap-1">
                    {!isReadOnly && (
                      <>
                        <button onClick={() => handleEditTelaio(telaio)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" title="Modifica">
                          <Settings size={16} />
                        </button>
                        <button
                          onClick={() => setConvertingTelaio(telaio)}
                          className="px-2.5 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium flex items-center gap-1"
                          title="Crea scheda veicolo"
                        >
                          <FilePlus size={14} />
                          <span className="hidden sm:inline">Crea Veicolo</span>
                        </button>
                        <button onClick={() => handleDeleteTelaio(telaio)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Elimina">
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="md:hidden px-3 pb-2 pt-0 border-t border-gray-100 flex flex-wrap gap-3 text-xs text-gray-500">
                  {telaio.dataArrivoVeicolo && <span><span className="text-gray-400">Arrivo:</span> {fmtDMY(telaio.dataArrivoVeicolo)}</span>}
                  {telaio.chiaviDoppioParcheggio && <span><span className="text-gray-400">Chiavi:</span> {telaio.chiaviDoppioParcheggio}</span>}
                  {telaio.note && <span className="truncate max-w-[200px]"><span className="text-gray-400">Note:</span> {telaio.note}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showTelaioModal && (
        <TelaioModal
          telaio={editingTelaio}
          onClose={() => setShowTelaioModal(false)}
          onSave={handleSaveTelaio}
        />
      )}

      {convertingTelaio && (
        <ConvertToVehicleModal
          telaio={convertingTelaio}
          userName={userName}
          onClose={() => setConvertingTelaio(null)}
          onConverted={handleConverted}
        />
      )}
    </div>
  );
};

export default TelaiPage;
