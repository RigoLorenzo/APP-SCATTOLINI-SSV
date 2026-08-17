import React, { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { toISO, fmtDMY } from '../../utils/dateUtils';

/**
 * Alert per veicoli in scadenza
 * @param {Array} vehicles - Lista veicoli
 * @param {Function} onSelectVehicle - Callback quando si clicca su un veicolo
 */
const ExpiringVehiclesAlert = ({ vehicles, onSelectVehicle }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const today = toISO(new Date());

  // Filtra ordini in ritardo: data consegna già superata, non ancora pronti o ritirati
  // Escludi veicoli con allestimento BOX o ISOTERMICO
  const lateVehicles = vehicles.filter(v =>
    v.dataConsegna &&
    v.dataConsegna < today &&
    v.status !== 'pronto' &&
    v.status !== 'ritirato' &&
    v.tipoAllestimento !== 'box' &&
    v.tipoAllestimento !== 'isotermico'
  ).sort((a, b) => a.dataConsegna.localeCompare(b.dataConsegna));

  if (lateVehicles.length === 0) return null;

  const getDaysDelayed = (isoDate) => {
    const d = new Date(isoDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.floor((now - d) / (1000 * 60 * 60 * 24));
  };

  const getDelayText = (days) => {
    if (days === 1) return '1 giorno';
    return `${days} giorni`;
  };

  return (
    <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-400 rounded-xl shadow-lg">
      {/* Header */}
      <div
        className="p-4 cursor-pointer flex items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="bg-red-600 text-white p-2 rounded-lg animate-pulse">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="font-bold text-red-900">
              {lateVehicles.length} {lateVehicles.length !== 1 ? 'veicoli' : 'veicolo'} in ritardo
            </h3>
            <p className="text-sm text-red-700">
              Data consegna già superata
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold animate-pulse">
            {lateVehicles.length}
          </span>
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>

      {/* Lista veicoli */}
      {isExpanded && (
        <div className="border-t border-red-200 bg-white">
          {lateVehicles.map((vehicle) => {
            const daysDelayed = getDaysDelayed(vehicle.dataConsegna);
            return (
              <div
                key={vehicle.id}
                onClick={() => onSelectVehicle(vehicle)}
                className="p-3 border-b border-gray-100 last:border-b-0 hover:bg-red-50 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-gray-900">{vehicle.committente}</div>
                  <span className="text-xs px-3 py-1 rounded-full font-bold bg-red-600 text-white">
                    +{getDelayText(daysDelayed)}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                  <div>
                    <span className="font-medium">Telaio:</span> {vehicle.numeroTelaio || 'N/A'}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar size={14} />
                    <span className="font-medium">Consegna:</span> {fmtDMY(vehicle.dataConsegna)}
                  </div>
                </div>
                <div className="mt-1">
                  <span className={`text-xs px-2 py-1 rounded ${
                    vehicle.status === 'da-allestire' ? 'bg-gray-200 text-gray-700' :
                    vehicle.status === 'in-allestimento' ? 'bg-yellow-200 text-yellow-700' :
                    'bg-gray-200 text-gray-700'
                  }`}>
                    {vehicle.status === 'da-allestire' ? 'Da Allestire' :
                     vehicle.status === 'in-allestimento' ? 'In Allestimento' :
                     vehicle.status}
                  </span>
                  {vehicle.urgente && (
                    <span className="ml-2 text-xs px-2 py-1 rounded bg-red-600 text-white font-bold">
                      URGENTE
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ExpiringVehiclesAlert;
