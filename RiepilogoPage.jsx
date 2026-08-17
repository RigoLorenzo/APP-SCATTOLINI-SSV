import { useState, useRef } from 'react';
import { Search, X, ClipboardList, Filter, ChevronDown } from 'lucide-react';
import VehicleCard from '../components/VehicleCard';
import { VEHICLE_STATUS_CONFIG } from '../constants/vehicleStatus';
import { useFilteredVehicles } from '../hooks/useFilteredVehicles';
import { searchVehicle } from '../utils/searchUtils';
import { VISTA_FILTER_DEFS, getAvailableTipiAllestimento, matchesTipoVistaFilters } from '../utils/vehicleFilters';

const RiepilogoPage = ({ vehicles, onEditVehicle, onDeleteVehicle }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedVehicleId, setHighlightedVehicleId] = useState(null);
  const highlightedRef = useRef(null);

  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedTipi, setSelectedTipi] = useState([]);
  const [vistaFilters, setVistaFilters] = useState([]);

  const availableTipi = getAvailableTipiAllestimento(vehicles);
  const activeFilterCount = selectedTipi.length + vistaFilters.length;

  const handleToggleTipo = (tipo) => {
    setSelectedTipi(prev => prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]);
  };
  const handleToggleVista = (id) => {
    setVistaFilters(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id]);
  };
  const handleClearFilters = () => {
    setSelectedTipi([]);
    setVistaFilters([]);
  };

  const filteredVehicles = vehicles.filter(v => matchesTipoVistaFilters(v, { selectedTipi, vistaIds: vistaFilters }));

  const vehiclesByStatus = {
    'da-allestire': useFilteredVehicles(filteredVehicles, ['da-allestire']),
    'in-allestimento': useFilteredVehicles(filteredVehicles, ['in-allestimento']),
    'pronto': useFilteredVehicles(filteredVehicles, ['pronto']),
    'ritirato': useFilteredVehicles(filteredVehicles, ['ritirato']),
  };


  // Funzione di ricerca globale su tutti i campi del veicolo
  const handleSearch = (term) => {
    setSearchTerm(term);
    if (!term.trim()) {
      setHighlightedVehicleId(null);
      return;
    }

    const foundVehicle = vehicles.find(v => searchVehicle(v, term));

    if (foundVehicle) {
      setHighlightedVehicleId(foundVehicle.id);
      // Scroll automatico al veicolo trovato
      setTimeout(() => {
        if (highlightedRef.current) {
          highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    } else {
      setHighlightedVehicleId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-2xl font-bold">Riepilogo Generale</h2>
      </div>

      {/* NUOVA BARRA DI RICERCA */}
      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="flex items-center gap-2">
          <Search size={20} className="text-gray-400" />
          <input
            type="text"
            placeholder="Cerca veicolo per targa, telaio, committente, SAP, matricola, codice..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searchTerm && (
            <button 
              onClick={() => handleSearch('')}
              className="p-2 text-gray-500 hover:text-gray-700"
            >
              <X size={20} />
            </button>
          )}
        </div>
        {searchTerm && highlightedVehicleId && (
          <p className="text-sm text-green-600 mt-2">✓ Veicolo trovato - scorri per visualizzarlo</p>
        )}
        {searchTerm && !highlightedVehicleId && (
          <p className="text-sm text-red-600 mt-2">✗ Nessun veicolo trovato con questi criteri</p>
        )}
      </div>

      {/* PANNELLO FILTRI A COMPARSA */}
      <div className="relative">
        <button
          onClick={() => setShowFilterPanel(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-white rounded-lg shadow-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <Filter size={16} className="text-gray-500" />
          Filtri
          {activeFilterCount > 0 && (
            <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">{activeFilterCount}</span>
          )}
          <ChevronDown size={16} className={`text-gray-400 transition-transform ${showFilterPanel ? 'rotate-180' : ''}`} />
        </button>

        {showFilterPanel && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowFilterPanel(false)} />
            <div className="absolute z-20 mt-2 w-full sm:w-[480px] bg-white rounded-lg shadow-xl border border-gray-200 p-4 space-y-3">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Tipo</p>
                <div className="flex flex-wrap gap-2">
                  {availableTipi.map(tipo => (
                    <label key={tipo} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedTipi.includes(tipo)}
                        onChange={() => handleToggleTipo(tipo)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="capitalize">{tipo}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Vista</p>
                <div className="flex flex-wrap gap-2">
                  {VISTA_FILTER_DEFS.map(({ id, label }) => (
                    <label key={id} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={vistaFilters.includes(id)}
                        onChange={() => handleToggleVista(id)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              {activeFilterCount > 0 && (
                <button
                  onClick={handleClearFilters}
                  className="text-xs text-red-500 hover:text-red-600"
                >
                  ✕ Cancella filtri
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* VEICOLI PER STATO - CON SCROLL CONTAINER PER OGNI SEZIONE */}
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <ClipboardList size={24} className="text-blue-600" />
          <h3 className="text-xl font-bold">Veicoli per Stato</h3>
        </div>
        <div className="grid grid-cols-1 gap-6">
          {Object.entries(vehiclesByStatus).map(([status, vehicleList]) => {
            const config = VEHICLE_STATUS_CONFIG[status];
            return (
              <div key={status} className={`${config.color} border-2 rounded-lg p-4`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{config.icon}</span>
                    <h4 className="font-bold text-lg">{config.label}</h4>
                  </div>
                  <span className="bg-white px-3 py-1 rounded-full text-sm font-bold">{vehicleList.length}</span>
                </div>
                {vehicleList.length > 0 ? (
                  <div className="max-h-[400px] overflow-y-auto pr-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {vehicleList.map(vehicle => (
                        <div
                          key={vehicle.id}
                          ref={vehicle.id === highlightedVehicleId ? highlightedRef : null}
                        >
                          <VehicleCard
                            variant="row"
                            vehicle={vehicle}
                            onEdit={onEditVehicle}
                            onDelete={onDeleteVehicle}
                            isHighlighted={vehicle.id === highlightedVehicleId}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm opacity-75 text-center py-4">Nessun veicolo</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};



export default RiepilogoPage;
