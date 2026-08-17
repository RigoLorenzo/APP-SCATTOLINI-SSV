import React, { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { searchVehicle } from '../../utils/searchUtils';
import { fmtDMY } from '../../utils/dateUtils';

/**
 * Barra di ricerca universale
 * @param {Array} vehicles - Lista veicoli
 * @param {Function} onSelectVehicle - Callback quando si seleziona un veicolo
 */
const UniversalSearch = ({ vehicles, onSelectVehicle }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setResults([]);
      setShowResults(false);
      return;
    }

    const filteredVehicles = vehicles
      .filter(v => searchVehicle(v, searchTerm))
      .slice(0, 10); // Limita a 10 risultati

    setResults(filteredVehicles);
    setShowResults(true);
  }, [searchTerm, vehicles]);

  // Chiudi risultati quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectVehicle = (vehicle) => {
    setSearchTerm('');
    setShowResults(false);
    onSelectVehicle(vehicle);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'da-allestire': return 'bg-gray-100 text-gray-700';
      case 'in-allestimento': return 'bg-yellow-100 text-yellow-700';
      case 'pronto': return 'bg-green-100 text-green-700';
      case 'ritirato': return 'bg-blue-100 text-blue-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'da-allestire': return 'Da Allestire';
      case 'in-allestimento': return 'In Allestimento';
      case 'pronto': return 'Pronto';
      case 'ritirato': return 'Ritirato';
      default: return status;
    }
  };

  return (
    <div className="relative" ref={searchRef}>
      <div className="relative">
        <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Cerca per committente, telaio, matricola, ordine SAP..."
          className="w-full md:w-96 border border-gray-300 rounded-lg pl-10 pr-10 py-2 bg-white text-gray-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onFocus={() => searchTerm && setShowResults(true)}
        />
        {searchTerm && (
          <button
            onClick={() => {
              setSearchTerm('');
              setShowResults(false);
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Risultati ricerca */}
      {showResults && results.length > 0 && (
        <div className="absolute top-full mt-2 w-full md:w-[500px] bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50">
          <div className="p-2 bg-gray-50 border-b border-gray-200 text-sm text-gray-600 font-medium">
            {results.length} risultati trovati
          </div>
          {results.map((vehicle) => (
            <div
              key={vehicle.id}
              onClick={() => handleSelectVehicle(vehicle)}
              className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="font-semibold text-gray-900">{vehicle.committente}</div>
                <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(vehicle.status)}`}>
                  {getStatusLabel(vehicle.status)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                {vehicle.numeroTelaio && (
                  <div>
                    <span className="font-medium">Telaio:</span> {vehicle.numeroTelaio}
                  </div>
                )}
                {vehicle.ordineSAP && (
                  <div>
                    <span className="font-medium">Ordine SAP:</span> {vehicle.ordineSAP}
                  </div>
                )}
                {vehicle.numeroMatricola && (
                  <div>
                    <span className="font-medium">Matricola:</span> {vehicle.numeroMatricola}
                  </div>
                )}
                {vehicle.numeroMatricolaLiderkit && (
                  <div>
                    <span className="font-medium">Matricola LDK:</span> {vehicle.numeroMatricolaLiderkit}
                  </div>
                )}
                {vehicle.dataConsegna && (
                  <div>
                    <span className="font-medium">Consegna:</span> {fmtDMY(vehicle.dataConsegna)}
                  </div>
                )}
              </div>
              {vehicle.tipoAllestimento && (
                <div className="mt-1 text-xs text-gray-500">
                  {vehicle.tipoAllestimento}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Nessun risultato */}
      {showResults && searchTerm && results.length === 0 && (
        <div className="absolute top-full mt-2 w-full md:w-96 bg-white border border-gray-200 rounded-lg shadow-xl p-4 z-50">
          <p className="text-gray-500 text-center">Nessun veicolo trovato</p>
        </div>
      )}
    </div>
  );
};

export default UniversalSearch;
