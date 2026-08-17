import { useState } from 'react';
import { AlertCircle, CheckCircle, Clock, Eye, Filter, Search, Truck, X } from 'lucide-react';
import { updateDoc, doc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db, logAction } from '../firebase';
import { useNotification } from '../contexts/NotificationContext';
import { toISO } from '../utils/dateUtils';
import VehicleCard from '../components/VehicleCard';
import { useFilteredVehicles } from '../hooks/useFilteredVehicles';
import { searchVehicle } from '../utils/searchUtils';
import { VISTA_FILTER_DEFS, getAvailableTipiAllestimento, matchesTipoVistaFilters } from '../utils/vehicleFilters';

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

const OfficinaPage = ({ vehicles, userName, onEditVehicle }) => {
  const { showToast } = useNotification();

  const today = toISO(new Date());
  const isLate = (v) =>
    v.dataConsegna &&
    v.dataConsegna < today &&
    v.status !== 'pronto' &&
    v.status !== 'ritirato';

  const [activeTab, setActiveTab] = useState('da-allestire');
  const [selectedFilters, setSelectedFilters] = useState([]);
  const [vistaFilters, setVistaFilters] = useState([]);
  const [statusChangeLoading, setStatusChangeLoading] = useState(null);
  const [urgentLoading, setUrgentLoading] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Filtra solo veicoli da-allestire e in-allestimento
  const workshopVehicles = useFilteredVehicles(vehicles, ['da-allestire', 'in-allestimento']);

  // Ottieni tipologie uniche disponibili
  const availableTypes = getAvailableTipiAllestimento(workshopVehicles);

  // Applica tutti i filtri combinati con logica AND: ricerca + tipologia + vista
  const filteredVehicles = workshopVehicles.filter(v => {
    if (searchTerm.trim() && !searchVehicle(v, searchTerm)) return false;
    if (!matchesTipoVistaFilters(v, { selectedTipi: selectedFilters, vistaIds: vistaFilters })) return false;
    return true;
  });

  // Separa per stato
  const daAllestire = useFilteredVehicles(filteredVehicles, ['da-allestire']);
  const inAllestimento = useFilteredVehicles(filteredVehicles, ['in-allestimento']);

  // Funzione per ordinare:
  //   1. urgente = true
  //   2. con numero telaio presente
  //   3. data consegna crescente
  //   4. senza numero telaio
  const sortVehicles = (vehicleList) => {
    return [...vehicleList].sort((a, b) => {
      // 1. urgenti prima
      if (Boolean(a.urgente) !== Boolean(b.urgente)) return a.urgente ? -1 : 1;
      // 2. veicoli con telaio prima
      const aHasVin = Boolean(a.numeroTelaio);
      const bHasVin = Boolean(b.numeroTelaio);
      if (aHasVin !== bHasVin) return aHasVin ? -1 : 1;
      // 3. data consegna crescente (fallback)
      const dateA = a.dataConsegna || '9999-12-31';
      const dateB = b.dataConsegna || '9999-12-31';
      return dateA.localeCompare(dateB);
    });
  };

  const sortedDaAllestire = sortVehicles(daAllestire);
  const sortedInAllestimento = sortVehicles(inAllestimento);

  const currentVehicles = activeTab === 'da-allestire' ? sortedDaAllestire : sortedInAllestimento;

  const handleToggleFilter = (tipo) => {
    setSelectedFilters(prev => 
      prev.includes(tipo) 
        ? prev.filter(t => t !== tipo)
        : [...prev, tipo]
    );
  };

  const hasActiveFilters = searchTerm.trim() || selectedFilters.length > 0 || vistaFilters.length > 0;

  const handleToggleVista = (id) => {
    setVistaFilters(prev =>
      prev.includes(id)
        ? prev.filter(v => v !== id)
        : [...prev, id]
    );
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedFilters([]);
    setVistaFilters([]);
  };

  const clearSearch = () => setSearchTerm('');

  const handleStatusChange = async (vehicle, newStatus) => {
    setStatusChangeLoading(vehicle.id);
    try {
      const updateData = { status: newStatus };

      // Auto-compilazione data montaggio quando passa a "pronto"
      if (newStatus === 'pronto' && vehicle.status === 'in-allestimento' && vehicle.modalitaRitiro !== 'montaggio') {
        updateData.dataMontaggio = toISO(new Date());
      }

      await updateDoc(doc(db, 'veicoli', vehicle.id), updateData);
      await logAction(userName, `Cambio stato a "${newStatus}"`, {
        committente: vehicle.committente,
        numeroTelaio: vehicle.numeroTelaio
      });

      if (vehicle.status !== 'pronto' && newStatus === 'pronto') {
        triggerVehicleReadyEmail(vehicle.id, { ...vehicle, ...updateData }, showToast);
      }
    } catch (error) {
      console.error('Errore:', error);
      showToast('Errore durante il cambio stato.', 'error');
    } finally {
      setStatusChangeLoading(null);
    }
  };

  const handleToggleUrgent = async (vehicle) => {
    setUrgentLoading(vehicle.id);
    try {
      const newUrgent = !vehicle.urgente;
      await updateDoc(doc(db, 'veicoli', vehicle.id), { urgente: newUrgent });
      await logAction(userName, newUrgent ? 'Impostato URGENTE' : 'Rimosso URGENTE', { 
        committente: vehicle.committente, 
        numeroTelaio: vehicle.numeroTelaio 
      });
    } catch (error) {
      console.error('Errore:', error);
      showToast('Errore durante la modifica.', 'error');
    } finally {
      setUrgentLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Officina</h2>
        <p className="text-sm text-gray-600 mt-0.5">
          {sortedDaAllestire.length} da allestire · {sortedInAllestimento.length} in allestimento
        </p>
      </div>

      {/* Barra di ricerca */}
      <div className="bg-white rounded-xl shadow-lg p-4">
        <div className="flex items-center gap-2">
          <Search size={20} className="text-gray-400" />
          <input
            type="text"
            placeholder="Cerca veicolo: telaio, committente, SAP, matricola, descrizione..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={clearSearch}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Pulisci ricerca"
            >
              <X size={20} />
            </button>
          )}
        </div>
        {hasActiveFilters && (
          <p className="mt-2 text-xs text-indigo-600 font-medium">
            {filteredVehicles.length} {filteredVehicles.length === 1 ? 'veicolo trovato' : 'veicoli trovati'} · i filtri attivi sono combinati
          </p>
        )}
      </div>

      {/* Tab di navigazione */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('da-allestire')}
            className={`flex-1 px-6 py-4 font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'da-allestire'
                ? 'bg-red-50 text-red-700 border-b-4 border-red-500'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Clock size={20} />
            Da Allestire
            <span className={`px-2 py-0.5 rounded-full text-sm ${
              activeTab === 'da-allestire' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {sortedDaAllestire.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('in-allestimento')}
            className={`flex-1 px-6 py-4 font-semibold transition-all flex items-center justify-center gap-2 ${
              activeTab === 'in-allestimento'
                ? 'bg-yellow-50 text-yellow-700 border-b-4 border-yellow-500'
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Truck size={20} />
            In Allestimento
            <span className={`px-2 py-0.5 rounded-full text-sm ${
              activeTab === 'in-allestimento' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {sortedInAllestimento.length}
            </span>
          </button>
        </div>

        {/* Filtri */}
        <div className="p-4 bg-gray-50 border-b space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={16} className="text-gray-500 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-600">Tipo:</span>
            {availableTypes.map(tipo => (
              <button
                key={tipo}
                onClick={() => handleToggleFilter(tipo)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  selectedFilters.includes(tipo)
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white text-gray-600 border border-gray-300 hover:border-indigo-400'
                }`}
              >
                {tipo}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-600 ml-6">Vista:</span>
            {VISTA_FILTER_DEFS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => handleToggleVista(id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  vistaFilters.includes(id)
                    ? id === 'noCoc' ? 'bg-blue-600 text-white' : 'bg-orange-500 text-white'
                    : id === 'noCoc'
                      ? 'bg-white text-gray-600 border border-gray-300 hover:border-blue-400'
                      : 'bg-white text-gray-600 border border-gray-300 hover:border-orange-400'
                }`}
              >
                {label}
              </button>
            ))}
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="text-xs text-red-500 hover:text-red-600 ml-1"
              >
                ✕ Pulisci tutto
              </button>
            )}
          </div>
        </div>

        {/* Lista veicoli */}
        <div className="p-3 bg-gray-50">
          {currentVehicles.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              {activeTab === 'da-allestire' ? (
                <>
                  <CheckCircle size={48} className="mx-auto mb-3 opacity-30" />
                  <p>Nessun veicolo da allestire</p>
                </>
              ) : (
                <>
                  <Truck size={48} className="mx-auto mb-3 opacity-30" />
                  <p>Nessun veicolo in lavorazione</p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              {currentVehicles.map(vehicle => (
                <VehicleCard
                  variant="compact"
                  key={vehicle.id}
                  vehicle={vehicle}
                  showStartButton={activeTab === 'da-allestire'}
                  isUrgentLoading={urgentLoading === vehicle.id}
                  isStatusLoading={statusChangeLoading === vehicle.id}
                  isLate={isLate(vehicle)}
                  onEdit={onEditVehicle}
                  onToggleUrgent={handleToggleUrgent}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Legenda */}
      <div className="bg-white rounded-lg shadow p-3 flex items-center gap-4 text-xs text-gray-600">
        <span className="font-medium">Legenda:</span>
        <div className="flex items-center gap-1">
          <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white">
            <AlertCircle size={12} />
          </div>
          <span>Urgente (clicca per toggle)</span>
        </div>
        <div className="flex items-center gap-1">
          <Eye size={16} className="text-gray-400" />
          <span>Apri scheda veicolo</span>
        </div>
      </div>

    </div>
  );
};


export default OfficinaPage;
