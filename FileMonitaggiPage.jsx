import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Search, X, Filter } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { useNotification } from '../contexts/NotificationContext';
import { fmtDMY, toISO, getDaysInMonth } from '../utils/dateUtils';
import { searchVehicle } from '../utils/searchUtils';
import DayDetailModal from '../components/modals/DayDetailModal';

const FileMonitaggiPage = ({ vehicles, onAddVehicle, onEditVehicle, onDeleteVehicle, onCopyVehicle }) => {
  const { isReadOnly } = useUser();
  const { showToast } = useNotification();
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedVehicleId, setHighlightedVehicleId] = useState(null);
  
  // Stati per i filtri
  const [showFilters, setShowFilters] = useState(false);
  const [filterCommittente, setFilterCommittente] = useState('');
  const [committenteSearch, setCommittenteSearch] = useState('');
  const [filterTipologie, setFilterTipologie] = useState([]);
  const [filterVista, setFilterVista] = useState(null); // null = tutti, 'senza-telaio', 'senza-sap'

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const dayNames = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  // Ottieni tipologie uniche per il filtro
  const availableTipologie = [...new Set(vehicles.map(v => v.tipoAllestimento).filter(Boolean))];

  // Ottieni committenti che corrispondono alla ricerca
  const filteredCommittenti = committenteSearch.trim().length >= 2
    ? [...new Set(vehicles.map(v => v.committente).filter(Boolean))]
        .filter(c => c.toLowerCase().includes(committenteSearch.toLowerCase()))
        .slice(0, 10) // Mostra max 10 risultati
    : [];

  // Applica tutti i filtri ai veicoli
  const getFilteredVehicles = () => {
    return vehicles.filter(v => {
      // MODIFICATO: Escludi veicoli ritirato dalla pagina file montaggi
      if (v.status === 'ritirato') {
        return false;
      }
      // Filtro committente
      if (filterCommittente && v.committente !== filterCommittente) {
        return false;
      }
      // Filtro tipologie (se selezionate)
      if (filterTipologie.length > 0 && !filterTipologie.includes(v.tipoAllestimento)) {
        return false;
      }
      // Filtro vista
      if (filterVista === 'senza-telaio' && v.numeroTelaio) return false;
      if (filterVista === 'senza-sap' && v.ordineSAP) return false;
      return true;
    });
  };

  const filteredVehicles = getFilteredVehicles();

  // Conta filtri attivi
  const activeFiltersCount = [
    filterCommittente ? 1 : 0,
    filterTipologie.length > 0 ? 1 : 0,
    filterVista !== null ? 1 : 0
  ].reduce((a, b) => a + b, 0);

  const getVehiclesForDay = (date) => {
    const dateStr = toISO(date);
    return filteredVehicles.filter(v => v.dataConsegna === dateStr);
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleDayClick = (dayObj) => {
    if (!dayObj.isCurrentMonth) return;
    const dayVehicles = getVehiclesForDay(dayObj.date);
    setSelectedDay({ date: dayObj.date, vehicles: dayVehicles });
  };

  // Funzione cerca
  const handleSearch = (term) => {
    setSearchTerm(term);
    setHighlightedVehicleId(null);
    
    if (!term.trim()) return;

    const foundVehicle = filteredVehicles.find(v => searchVehicle(v, term));

    if (foundVehicle && foundVehicle.dataConsegna) {
      const deliveryDate = new Date(foundVehicle.dataConsegna);
      setCurrentMonth(deliveryDate.getMonth());
      setCurrentYear(deliveryDate.getFullYear());
      setHighlightedVehicleId(foundVehicle.id);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setHighlightedVehicleId(null);
  };

  const clearAllFilters = () => {
    setFilterCommittente('');
    setCommittenteSearch('');
    setFilterTipologie([]);
    setFilterVista(null);
  };

  const handleToggleTipologia = (tipo) => {
    setFilterTipologie(prev => 
      prev.includes(tipo) 
        ? prev.filter(t => t !== tipo)
        : [...prev, tipo]
    );
  };

  const highlightedVehicle = highlightedVehicleId 
    ? filteredVehicles.find(v => v.id === highlightedVehicleId) 
    : null;

  const today = toISO(new Date());

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h2 className="text-2xl font-bold">File Montaggi - Calendario</h2>
        <div className="flex gap-2">
          {!isReadOnly && (
            <button onClick={onAddVehicle} className="bg-blue-600 text-white px-4 sm:px-4 py-3 sm:py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 min-w-[48px] active:scale-95">
              <Plus size={20} />
              <span className="hidden sm:inline">Nuovo Veicolo</span>
            </button>
          )}
        </div>
      </div>

      {/* BARRA DI RICERCA CON FILTRI */}
      <div className="bg-white rounded-lg shadow-lg p-4 space-y-3">
        {/* Riga ricerca */}
        <div className="flex items-center gap-2">
          <Search size={20} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Cerca veicolo: telaio, committente, SAP, matricola..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            value={searchTerm}
            onChange={(e) => handleSearch(e.target.value)}
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
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex-shrink-0 ${
              activeFiltersCount > 0
                ? 'bg-indigo-600 text-white'
                : showFilters
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title="Filtri avanzati"
          >
            <Filter size={16} />
            <span className="hidden sm:inline">Filtri</span>
            {activeFiltersCount > 0 && (
              <span className="bg-white text-indigo-700 text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Feedback ricerca */}
        {searchTerm && highlightedVehicle && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-green-700 font-medium">
                ✓ Trovato: <strong>{highlightedVehicle.committente}</strong>
              </p>
              <p className="text-xs text-green-600 mt-0.5">
                Consegna: {fmtDMY(highlightedVehicle.dataConsegna)} · {highlightedVehicle.tipoAllestimento}
              </p>
            </div>
            <button
              onClick={() => onEditVehicle(highlightedVehicle)}
              className="text-sm bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors flex-shrink-0"
            >
              Apri Scheda
            </button>
          </div>
        )}
        {searchTerm && !highlightedVehicle && (
          <p className="text-sm text-red-600">✗ Nessun veicolo trovato</p>
        )}

        {/* Panel filtri inline collassabile */}
        {showFilters && (
          <div className="border border-indigo-200 rounded-xl bg-indigo-50 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-indigo-800 flex items-center gap-2 text-sm">
                <Filter size={15} />
                Filtri Avanzati
              </h4>
              {activeFiltersCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="text-xs text-red-500 hover:text-red-700 font-medium"
                >
                  Pulisci tutti
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Filtro Committente */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Committente</label>
                {filterCommittente ? (
                  <div className="flex items-center gap-1.5 bg-indigo-100 border border-indigo-300 rounded-lg px-2.5 py-1.5">
                    <span className="flex-1 text-sm font-medium text-indigo-800 truncate">{filterCommittente}</span>
                    <button onClick={() => { setFilterCommittente(''); setCommittenteSearch(''); }} className="text-indigo-500 hover:text-indigo-700 flex-shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Cerca committente..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 bg-white"
                      value={committenteSearch}
                      onChange={(e) => setCommittenteSearch(e.target.value)}
                    />
                    {filteredCommittenti.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {filteredCommittenti.map(c => (
                          <button key={c} onClick={() => { setFilterCommittente(c); setCommittenteSearch(''); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors">
                            {c}
                          </button>
                        ))}
                      </div>
                    )}
                    {committenteSearch.length > 0 && committenteSearch.length < 2 && (
                      <p className="text-xs text-gray-400 mt-1">Digita almeno 2 caratteri</p>
                    )}
                  </div>
                )}
              </div>

              {/* Filtro Tipologia */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Tipologia</label>
                <div className="flex flex-wrap gap-1.5">
                  {availableTipologie.map(tipo => (
                    <button
                      key={tipo}
                      onClick={() => handleToggleTipologia(tipo)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                        filterTipologie.includes(tipo)
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-purple-400'
                      }`}
                    >
                      {tipo}{filterTipologie.includes(tipo) && ' ✓'}
                    </button>
                  ))}
                  {availableTipologie.length === 0 && <p className="text-xs text-gray-400">Nessuna tipologia</p>}
                </div>
              </div>

              {/* Filtro Vista */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Vista</label>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => setFilterVista(filterVista === 'senza-telaio' ? null : 'senza-telaio')}
                    className={`py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 border ${
                      filterVista === 'senza-telaio' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-300 hover:border-orange-400'
                    }`}
                  >
                    Senza N° Telaio
                  </button>
                  <button
                    onClick={() => setFilterVista(filterVista === 'senza-sap' ? null : 'senza-sap')}
                    className={`py-1.5 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-1 border ${
                      filterVista === 'senza-sap' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-300 hover:border-orange-400'
                    }`}
                  >
                    Senza N° Ordine SAP
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filtri attivi (quando pannello chiuso) */}
        {activeFiltersCount > 0 && !showFilters && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500">Attivi:</span>
            {filterCommittente && (
              <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs flex items-center gap-1">
                {filterCommittente}
                <button onClick={() => setFilterCommittente('')} className="hover:text-indigo-900">×</button>
              </span>
            )}
            {filterTipologie.map(tipo => (
              <span key={tipo} className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-xs flex items-center gap-1">
                {tipo}
                <button onClick={() => handleToggleTipologia(tipo)} className="hover:text-purple-900">×</button>
              </span>
            ))}
            {filterVista !== null && (
              <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs flex items-center gap-1">
                {filterVista === 'senza-telaio' ? 'Senza N° Telaio' : 'Senza N° Ordine SAP'}
                <button onClick={() => setFilterVista(null)} className="hover:text-orange-900">×</button>
              </span>
            )}
            <button onClick={clearAllFilters} className="text-xs text-red-500 hover:text-red-700 ml-1">Pulisci tutti</button>
          </div>
        )}
      </div>

      {/* Info veicoli filtrati */}
      {activeFiltersCount > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 flex items-center justify-between">
          <p className="text-sm text-indigo-700">
            <strong>{filteredVehicles.length}</strong> veicoli corrispondono ai filtri selezionati
            {filteredVehicles.length !== vehicles.length && (
              <span className="text-indigo-500"> (su {vehicles.length} totali)</span>
            )}
          </p>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="flex items-center justify-between mb-6">
          <button onClick={handlePrevMonth} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors">
            <ChevronLeft size={24} />
          </button>
          <div className="text-center">
            <h3 className="text-2xl font-bold text-gray-800">{monthNames[currentMonth]} {currentYear}</h3>
            <p className="text-sm text-gray-600 mt-1">{filteredVehicles.length} veicoli totali</p>
          </div>
          <button onClick={handleNextMonth} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors">
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Header giorni - Desktop */}
        <div className="hidden md:grid grid-cols-7 gap-2 mb-2">
          {dayNames.map(day => (
            <div key={day} className="text-center font-bold text-gray-600 text-sm py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendario Desktop - Griglia 7 colonne */}
        <div className="hidden md:grid md:grid-cols-7 gap-2">
          {daysInMonth.map((dayObj, idx) => {
            const dayVehicles = getVehiclesForDay(dayObj.date);
            const dayStr = toISO(dayObj.date);
            const isToday = dayStr === today;
            const isCurrentMonth = dayObj.isCurrentMonth;

            const hasHighlightedVehicle = highlightedVehicleId &&
              dayVehicles.some(v => v.id === highlightedVehicleId);

            return (
              <div
                key={idx}
                onClick={() => handleDayClick(dayObj)}
                className={`
                  min-h-[100px] border-2 rounded-lg p-2 transition-all
                  ${isCurrentMonth ? 'bg-white' : 'bg-gray-50 opacity-40'}
                  ${isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}
                  ${hasHighlightedVehicle ? 'border-green-500 bg-green-50 ring-2 ring-green-400' : ''}
                  ${dayVehicles.length > 0 && isCurrentMonth ? 'cursor-pointer hover:shadow-lg hover:scale-[1.02]' : ''}
                `}
              >
                <div className={`text-right font-bold mb-1 ${isToday ? 'text-blue-600' : isCurrentMonth ? 'text-gray-800' : 'text-gray-400'} ${hasHighlightedVehicle ? 'text-green-600' : ''}`}>
                  {dayObj.date.getDate()}
                </div>

                {isCurrentMonth && dayVehicles.length > 0 && (
                  <div className="space-y-1">
                    {dayVehicles.slice(0, 2).map(vehicle => {
                      const statusColors = {
                        'da-allestire': 'bg-red-100 text-red-700 border-red-300',
                        'in-allestimento': 'bg-yellow-100 text-yellow-700 border-yellow-300',
                        'pronto': 'bg-green-100 text-green-700 border-green-300',
                        'ritirato': 'bg-blue-100 text-blue-700 border-blue-300'
                      };
                      const colorClass = statusColors[vehicle.status] || statusColors['da-allestire'];
                      const isHighlighted = vehicle.id === highlightedVehicleId;

                      return (
                        <div
                          key={vehicle.id}
                          className={`${colorClass} border rounded px-2 py-1 text-xs font-medium truncate ${isHighlighted ? 'ring-2 ring-green-500 bg-green-200 text-green-800' : ''}`}
                          title={`${vehicle.committente} - ${vehicle.tipoAllestimento}`}
                        >
                          {vehicle.committente}
                        </div>
                      );
                    })}
                    {dayVehicles.length > 2 && (
                      <div className="bg-gray-200 text-gray-700 border border-gray-400 rounded px-2 py-1 text-xs font-bold text-center">
                        +{dayVehicles.length - 2} altri
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Vista Mobile - Lista giorni con veicoli */}
        <div className="md:hidden space-y-3">
          {daysInMonth.filter(dayObj => dayObj.isCurrentMonth).map((dayObj, idx) => {
            const dayVehicles = getVehiclesForDay(dayObj.date);
            const dayStr = toISO(dayObj.date);
            const isToday = dayStr === today;
            const dayName = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'][dayObj.date.getDay()];

            const hasHighlightedVehicle = highlightedVehicleId &&
              dayVehicles.some(v => v.id === highlightedVehicleId);

            // Mostra solo giorni con veicoli o oggi
            if (dayVehicles.length === 0 && !isToday) return null;

            return (
              <div
                key={idx}
                onClick={() => handleDayClick(dayObj)}
                className={`
                  border-2 rounded-xl p-4 transition-all cursor-pointer active:scale-[0.98]
                  ${isToday ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}
                  ${hasHighlightedVehicle ? 'border-green-500 bg-green-50 ring-2 ring-green-400' : ''}
                  ${dayVehicles.length > 0 ? 'hover:shadow-lg' : ''}
                `}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className={`text-2xl font-bold ${isToday ? 'text-blue-600' : hasHighlightedVehicle ? 'text-green-600' : 'text-gray-800'}`}>
                      {dayObj.date.getDate()}
                    </div>
                    <div className="text-sm text-gray-600">{dayName}</div>
                  </div>
                  {dayVehicles.length > 0 && (
                    <div className="bg-indigo-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                      {dayVehicles.length}
                    </div>
                  )}
                </div>

                {dayVehicles.length > 0 && (
                  <div className="space-y-2">
                    {dayVehicles.map(vehicle => {
                      const statusColors = {
                        'da-allestire': 'bg-red-100 text-red-700 border-red-300',
                        'in-allestimento': 'bg-yellow-100 text-yellow-700 border-yellow-300',
                        'pronto': 'bg-green-100 text-green-700 border-green-300',
                        'ritirato': 'bg-blue-100 text-blue-700 border-blue-300'
                      };
                      const colorClass = statusColors[vehicle.status] || statusColors['da-allestire'];
                      const isHighlighted = vehicle.id === highlightedVehicleId;

                      return (
                        <div
                          key={vehicle.id}
                          className={`${colorClass} border-2 rounded-lg px-3 py-2 ${isHighlighted ? 'ring-2 ring-green-500 bg-green-200 text-green-800' : ''}`}
                        >
                          <div className="font-semibold text-sm">{vehicle.committente}</div>
                          {vehicle.tipoAllestimento && (
                            <div className="text-xs opacity-75 mt-0.5">{vehicle.tipoAllestimento}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {dayVehicles.length === 0 && isToday && (
                  <p className="text-sm text-gray-500 italic">Nessun veicolo programmato</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Legenda Stati:</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-red-100 border-2 border-red-400 rounded"></div>
              <span className="text-xs">Da Allestire</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-yellow-100 border-2 border-yellow-400 rounded"></div>
              <span className="text-xs">In Allestimento</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border-2 border-green-400 rounded"></div>
              <span className="text-xs">Pronto</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-100 border-2 border-blue-400 rounded"></div>
              <span className="text-xs">Ritirato</span>
            </div>
          </div>
        </div>
      </div>

      {selectedDay && (
        <DayDetailModal
          date={selectedDay.date}
          vehicles={selectedDay.vehicles}
          onClose={() => setSelectedDay(null)}
          onEdit={onEditVehicle}
          onDelete={onDeleteVehicle}
          onCopy={onCopyVehicle}
          highlightedVehicleId={highlightedVehicleId}
        />
      )}
    </div>
  );
};





export default FileMonitaggiPage;
