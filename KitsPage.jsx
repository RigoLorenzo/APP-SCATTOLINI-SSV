import { useState, useEffect } from 'react';
import { Copy, Filter, Package, Plus, Search, Settings, Trash2, FilePlus, X, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage, logAction } from '../firebase';
import { toISO } from '../utils/dateUtils';
import { useUser } from '../contexts/UserContext';
import { useNotification } from '../contexts/NotificationContext';
import { KIT_CATEGORIE } from '../constants/kitCategories';
import KitModal from '../components/modals/KitModal';

// ─────────────────────────────────────────────────────────────────────────────
// Modale di conversione Kit → Scheda Veicolo
// ─────────────────────────────────────────────────────────────────────────────
const ConvertToVehicleModal = ({ kit, userName, onClose, onConverted }) => {
  const { showToast } = useNotification();
  const [saving, setSaving] = useState(false);
  const [removeFromStock, setRemoveFromStock] = useState(true);
  const [form, setForm] = useState({
    committente: kit.cliente || '',
    dataConsegna: '',
    tipoAllestimento: 'box',
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
        // Mappati dal kit
        numeroMatricolaLiderkit: kit.numeroMatricolaLiderkit || '',
        descrizioneAllestimento: kit.dimensioniKit || '',
        note:                   kit.specifiche    || '',
        // Stato iniziale
        status:                 'da-allestire',
        dataArrivo:             toISO(new Date()),
        // Tutti gli altri campi a default
        dataMontaggio:          '',
        modalitaConsegna:       '',
        numeroTelaio:           '',
        chiaviDoppioParcheggio: '',
        posizioneParcheggio:    '',
        ordineSAP:              '',
        numeroMatricola:        '',
        weekSpedizioneKit:      '',
        codiceAllestimento:     '',
        codiceAllestimentoSAP:  '',
        descrizioneAllestimentoSAP: '',
        omologazioneCollaudo:   '',
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
      await logAction(userName, 'Creazione Veicolo da Materiale LDK', {
        committente:      form.committente,
        matricolaLiderkit: kit.numeroMatricolaLiderkit,
      });

      if (removeFromStock) {
        await deleteDoc(doc(db, 'kits', kit.id));
        await logAction(userName, 'Materiale LDK rimosso dal magazzino (convertito in veicolo)', {
          matricolaLiderkit: kit.numeroMatricolaLiderkit,
        });
      }

      onConverted(removeFromStock);
    } catch (err) {
      console.error('Errore conversione kit:', err);
      showToast('Errore durante la creazione della scheda veicolo.', 'error');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">

        {/* Header */}
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
          {/* Riepilogo kit */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-5">
            <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">
              Materiale LDK selezionato
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <div>
                <span className="text-gray-500">Matricola: </span>
                <span className="font-semibold font-mono">{kit.numeroMatricolaLiderkit}</span>
              </div>
              <div>
                <span className="text-gray-500">Dimensioni: </span>
                <span className="font-semibold">{kit.dimensioniKit}</span>
              </div>
              {kit.specifiche && (
                <div className="col-span-2">
                  <span className="text-gray-500">Specifiche: </span>
                  <span>{kit.specifiche}</span>
                </div>
              )}
            </div>
          </div>

          {/* Mapping automatico */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-5 text-xs text-green-800">
            <p className="font-semibold mb-1">Campi compilati automaticamente:</p>
            <ul className="space-y-0.5">
              <li>• <strong>N° Matricola Liderkit</strong> ← {kit.numeroMatricolaLiderkit}</li>
              <li>• <strong>Descrizione Allestimento</strong> ← {kit.dimensioniKit}</li>
              {kit.specifiche && <li>• <strong>Note</strong> ← {kit.specifiche}</li>}
            </ul>
          </div>

          {/* Campi obbligatori */}
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
                {tipoOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 pt-1 pb-1">
              <input
                type="checkbox"
                id="removeFromStock"
                checked={removeFromStock}
                onChange={(e) => setRemoveFromStock(e.target.checked)}
                className="w-4 h-4 accent-green-600"
              />
              <label htmlFor="removeFromStock" className="text-sm text-gray-700 cursor-pointer">
                Rimuovi dal magazzino LDK dopo la creazione
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
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
const KitsPage = ({ userName }) => {
  const { isReadOnly } = useUser();
  const { showToast, showConfirm } = useNotification();
  const [kits, setKits] = useState([]);
  const [showKitModal, setShowKitModal] = useState(false);
  const [editingKit, setEditingKit] = useState(null);
  const [convertingKit, setConvertingKit] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedKitId, setExpandedKitId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'kits'), orderBy('numeroMatricolaLiderkit', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setKits(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      console.error('kits listener error:', error);
      showToast('Errore caricamento materiale LDK.', 'error');
    });
    return unsubscribe;
  }, []);

  const handleAddKit = () => {
    setEditingKit(null);
    setShowKitModal(true);
  };

  const handleEditKit = (kit) => {
    setEditingKit(kit);
    setShowKitModal(true);
  };

  const handleSaveKit = async (kitData) => {
    try {
      if (editingKit) {
        await updateDoc(doc(db, 'kits', editingKit.id), kitData);
        await logAction(userName, 'Modifica Materiale LDK', { cliente: kitData.cliente, matricola: kitData.numeroMatricolaLiderkit });
      } else {
        await addDoc(collection(db, 'kits'), kitData);
        await logAction(userName, 'Aggiunta Materiale LDK', { cliente: kitData.cliente, matricola: kitData.numeroMatricolaLiderkit });
      }
      setShowKitModal(false);
    } catch (error) {
      console.error('Errore:', error);
      showToast('Errore durante il salvataggio.', 'error');
    }
  };

  const handleDeleteKit = async (kitId, kit) => {
    if (!await showConfirm('Eliminare questo materiale LDK?')) return;
    try {
      // Elimina eventuali file da Storage
      if (kit.files?.length > 0) {
        await Promise.all(kit.files.map(async (f) => {
          if (f.storagePath) {
            try { await deleteObject(ref(storage, f.storagePath)); } catch {}
          }
        }));
      }
      await deleteDoc(doc(db, 'kits', kitId));
      await logAction(userName, 'Eliminazione Materiale LDK', { cliente: kit.cliente, matricola: kit.numeroMatricolaLiderkit });
    } catch (error) {
      console.error('Errore:', error);
      showToast('Errore durante l\'eliminazione.', 'error');
    }
  };

  const handleDuplicateKit = async (kit) => {
    try {
      const { id, ...kitData } = kit;
      const duplicate = { ...kitData, numeroMatricolaLiderkit: kit.numeroMatricolaLiderkit + ' (copia)' };
      await addDoc(collection(db, 'kits'), duplicate);
      await logAction(userName, 'Duplicazione Materiale LDK', { cliente: kit.cliente, matricola: kit.numeroMatricolaLiderkit });
      showToast('Scheda duplicata con successo.', 'success');
    } catch (error) {
      console.error('Errore duplicazione:', error);
      showToast('Errore durante la duplicazione.', 'error');
    }
  };

  const handleConverted = (wasRemoved) => {
    setConvertingKit(null);
    if (wasRemoved) {
      showToast('Scheda veicolo creata e materiale rimosso dal magazzino.', 'success');
    } else {
      showToast('Scheda veicolo creata. Il materiale rimane in magazzino.', 'success');
    }
  };

  const filteredKits = kits.filter(kit =>
    (kit.cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      kit.numeroMatricolaLiderkit?.toLowerCase().includes(searchTerm.toLowerCase())) &&
    (categoryFilter === '' || kit.categoria === categoryFilter)
  );

  const categoryCounts = Object.fromEntries(
    KIT_CATEGORIE.map(cat => [cat, kits.filter(k => k.categoria === cat).length])
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Materiale LDK a Stock</h2>
          <p className="text-sm text-gray-600 mt-1">
            {categoryFilter || searchTerm.trim()
              ? `${filteredKits.length} di ${kits.length} materiali in magazzino`
              : `${kits.length} materiali in magazzino`}
          </p>
        </div>
        <div className="flex gap-2">
          {!isReadOnly && (
            <button
              onClick={handleAddKit}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <Plus size={18} />
              Nuovo Materiale LDK
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="flex items-center gap-2 mb-4">
          <Search size={20} className="text-gray-400" />
          <input
            type="text"
            placeholder="Cerca per cliente o matricola..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-4">
          <Filter size={16} className="text-gray-500 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-600">Categoria:</span>
          <button
            onClick={() => setCategoryFilter('')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
              categoryFilter === ''
                ? 'bg-purple-600 text-white'
                : 'bg-white text-gray-600 border border-gray-300 hover:border-purple-400'
            }`}
          >
            Tutte ({kits.length})
          </button>
          {KIT_CATEGORIE.map(cat => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                categoryFilter === cat
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:border-purple-400'
              }`}
            >
              {cat} ({categoryCounts[cat]})
            </button>
          ))}
        </div>

        {filteredKits.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Package size={64} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg">Nessun materiale LDK trovato</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredKits.map(kit => {
              const fileCount = kit.files?.length || 0;
              const isExpanded = expandedKitId === kit.id;
              return (
                <div key={kit.id} className="bg-white rounded-lg shadow-sm border border-gray-200 border-l-4 border-l-purple-500 hover:shadow-md transition-all">
                  {/* RIGA PRINCIPALE */}
                  <div className="px-3 py-2.5 flex items-center gap-3">
                    {/* Dati in colonne */}
                    <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-6 gap-2 text-xs">
                      <div className="col-span-2 md:col-span-1">
                        <p className="text-gray-400 text-[10px] uppercase tracking-wide">Cliente</p>
                        <p className="font-bold text-gray-900 truncate text-sm">{kit.cliente || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-[10px] uppercase">Matricola</p>
                        <p className="font-semibold text-purple-700 font-mono truncate">{kit.numeroMatricolaLiderkit || '-'}</p>
                      </div>
                      <div className="hidden md:block">
                        <p className="text-gray-400 text-[10px] uppercase">Categoria</p>
                        <p className="font-semibold text-gray-700 truncate">{kit.categoria || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-[10px] uppercase">Dimensioni</p>
                        <p className="font-semibold text-gray-700 truncate">{kit.dimensioniKit || '-'}</p>
                      </div>
                      <div className="hidden md:block">
                        <p className="text-gray-400 text-[10px] uppercase">Consegna materiale</p>
                        <p className="font-semibold text-blue-700 truncate">{kit.dataConsegnaMateriale || '-'}</p>
                      </div>
                      <div className="hidden md:block">
                        <p className="text-gray-400 text-[10px] uppercase">Specifiche</p>
                        <p className="text-gray-600 truncate">{kit.specifiche || '-'}</p>
                      </div>
                    </div>

                    {/* Azioni */}
                    <div className="flex-shrink-0 flex items-center gap-1">
                      {/* Badge file */}
                      {fileCount > 0 && (
                        <button
                          onClick={() => setExpandedKitId(isExpanded ? null : kit.id)}
                          className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium hover:bg-purple-200 transition-colors"
                          title="Mostra/nascondi file"
                        >
                          <FileText size={13} />
                          {fileCount}
                          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>
                      )}

                      {!isReadOnly && (
                        <>
                          <button onClick={() => handleEditKit(kit)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors" title="Modifica">
                            <Settings size={16} />
                          </button>
                          <button onClick={() => handleDuplicateKit(kit)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Duplica">
                            <Copy size={16} />
                          </button>
                          <button
                            onClick={() => setConvertingKit(kit)}
                            className="px-2.5 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-xs font-medium flex items-center gap-1"
                            title="Crea scheda veicolo"
                          >
                            <FilePlus size={14} />
                            <span className="hidden sm:inline">Crea Veicolo</span>
                          </button>
                          <button onClick={() => handleDeleteKit(kit.id, kit)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Elimina">
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* INFO MOBILE SECONDARIA */}
                  <div className="md:hidden px-3 pb-2 pt-0 border-t border-gray-100 flex flex-wrap gap-3 text-xs text-gray-500">
                    {kit.categoria && <span><span className="text-gray-400">Categoria:</span> {kit.categoria}</span>}
                    {kit.dataConsegnaMateriale && <span><span className="text-gray-400">Consegna:</span> {kit.dataConsegnaMateriale}</span>}
                    {kit.specifiche && <span className="truncate max-w-[200px]"><span className="text-gray-400">Note:</span> {kit.specifiche}</span>}
                  </div>

                  {/* SEZIONE FILE ESPANSA */}
                  {isExpanded && fileCount > 0 && (
                    <div className="border-t border-purple-100 bg-purple-50 px-3 py-3">
                      <div className="flex flex-wrap gap-3">
                        {kit.files.map((f, i) => {
                          const isImg = f.type?.startsWith('image/');
                          return (
                            <a
                              key={i}
                              href={f.downloadURL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex flex-col items-center gap-1 group"
                              title={f.name}
                            >
                              <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-purple-200 bg-white flex items-center justify-center group-hover:border-purple-500 transition-colors shadow-sm">
                                {isImg ? (
                                  <img src={f.downloadURL} alt={f.name} className="w-full h-full object-cover" />
                                ) : (
                                  <FileText size={28} className="text-red-500" />
                                )}
                              </div>
                              <span className="text-[10px] text-gray-600 max-w-[64px] truncate text-center">{f.name}</span>
                            </a>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => handleEditKit(kit)}
                        className="mt-2 text-xs text-purple-600 hover:text-purple-800 underline"
                      >
                        Gestisci file →
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showKitModal && (
        <KitModal
          kit={editingKit}
          onClose={() => setShowKitModal(false)}
          onSave={handleSaveKit}
        />
      )}

      {convertingKit && (
        <ConvertToVehicleModal
          kit={convertingKit}
          userName={userName}
          onClose={() => setConvertingKit(null)}
          onConverted={handleConverted}
        />
      )}
    </div>
  );
};

export default KitsPage;
