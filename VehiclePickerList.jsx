import { Search } from 'lucide-react';
import { filterVehiclesBySearch } from '../../utils/searchUtils';

/**
 * Lista veicoli con ricerca, riusata per la selezione veicolo nei popup di
 * assegnazione da calendario (Collaudi, Pianificazione Ritiri) ed estratta
 * dal blocco che prima era duplicato inline in PianificazioneRitiriPage
 * (select + input ricerca, vedi ARCHITETTURA_SSV_MANAGER.md §9).
 */
const VehiclePickerList = ({
  vehicles,
  selectedId,
  onSelect,
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Filtra per qualsiasi campo del veicolo...',
  emptyLabel = 'Nessun veicolo disponibile',
  size = 5,
}) => {
  const filtered = filterVehiclesBySearch(vehicles, searchTerm);

  return (
    <div>
      <div className="relative mb-2">
        <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder={searchPlaceholder}
          className="w-full border border-gray-300 rounded-lg pl-10 pr-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <select
        className="w-full border border-gray-300 rounded-lg px-3 py-2"
        value={selectedId || ''}
        onChange={(e) => onSelect(filtered.find(v => v.id === e.target.value) || null)}
        size={size}
      >
        <option value="">-- Seleziona un veicolo --</option>
        {filtered.map(v => (
          <option key={v.id} value={v.id}>
            {v.committente} - Telaio: {v.numeroTelaio || 'N/A'} - Matricola: {v.numeroMatricola || 'N/A'}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-500 mt-1">
        {filtered.length > 0 ? `${filtered.length} veicoli disponibili` : emptyLabel}
      </p>
    </div>
  );
};

export default VehiclePickerList;
