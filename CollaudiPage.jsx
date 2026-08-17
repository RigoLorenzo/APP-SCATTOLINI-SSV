import { useState, useRef } from 'react';
import { CheckSquare, ChevronLeft, ChevronRight, Eye, Search, X, AlertCircle, CheckCircle, CalendarPlus } from 'lucide-react';
import { updateDoc, doc, runTransaction } from 'firebase/firestore';
import { db, logAction } from '../firebase';
import { useUser } from '../contexts/UserContext';
import { useNotification } from '../contexts/NotificationContext';
import { fmtDMY, toISO, getDaysInMonth } from '../utils/dateUtils';
import { isCollaudoCalendarRelevant, isCollaudoDone, formatCollaudoBadge, getUnplannedCollaudoVehicles } from '../utils/collaudoUtils';
import { searchVehicle } from '../utils/searchUtils';
import VehiclePickerList from '../components/Common/VehiclePickerList';

const CollaudiPage = ({ vehicles, onEditVehicle, userName }) => {
  const { isReadOnly } = useUser();
  const { showToast } = useNotification();
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedVehicleId, setHighlightedVehicleId] = useState(null);
  const [assignVehicle, setAssignVehicle] = useState(null);
  const [assignSearchTerm, setAssignSearchTerm] = useState('');
  const [assigning, setAssigning] = useState(false);
  const highlightedRef = useRef(null);

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const dayNames = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  // Da-collaudare, pianificato e collaudo-eseguito sono rilevanti per questa pagina
  const isRelevant = isCollaudoCalendarRelevant;
  const isCollaudoCompleted = isCollaudoDone;

  const getBadgeColor = (vehicle) => {
    if (isCollaudoDone(vehicle)) return 'bg-green-100 border-green-400 text-green-800';
    return 'bg-orange-100 border-orange-400 text-orange-800';
  };

  const getCollaudoLabel = formatCollaudoBadge;


  const handleSearch = (term) => {
    setSearchTerm(term);
    setHighlightedVehicleId(null);
    if (!term.trim()) return;

    const found = vehicles.find(v => v.dataCollaudo && searchVehicle(v, term));
    if (found) {
      setHighlightedVehicleId(found.id);
      if (found.dataCollaudo) {
        const d = new Date(found.dataCollaudo + 'T12:00:00');
        setCurrentMonth(d.getMonth());
        setCurrentYear(d.getFullYear());
      }
      setTimeout(() => {
        if (highlightedRef.current) highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
    }
  };

  const getVehiclesForDay = (date) => {
    const dateStr = toISO(date);
    let dayVehicles = vehicles.filter(v => v.dataCollaudo === dateStr && isRelevant(v));
    if (searchTerm.trim()) {
      dayVehicles = dayVehicles.filter(v => searchVehicle(v, searchTerm));
    }
    return dayVehicles;
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };
  const handleNextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };

  const handleQuickUpdateCollaudo = async (vehicle, newStatus) => {
    if (isReadOnly) return;
    try {
      await updateDoc(doc(db, 'veicoli', vehicle.id), { collaudo: newStatus });
      await logAction(userName, `Collaudo aggiornato a "${newStatus}"`, {
        committente: vehicle.committente,
        numeroTelaio: vehicle.numeroTelaio
      });
      if (selectedDay) {
        const updated = selectedDay.vehicles.map(v =>
          v.id === vehicle.id ? { ...v, collaudo: newStatus } : v
        );
        setSelectedDay({ ...selectedDay, vehicles: updated });
      }
      showToast('Collaudo aggiornato', 'success');
    } catch (err) {
      console.error(err);
      showToast('Errore aggiornamento collaudo', 'error');
    }
  };

  // Assegnazione veicolo da calendario: click su un giorno -> scelta di un
  // veicolo "da collaudare" ancora senza data -> collaudo diventa
  // "pianificato" con dataCollaudo = giorno cliccato. Usa una transazione
  // Firestore per evitare che due utenti assegnino lo stesso veicolo a due
  // giorni diversi in scritture quasi simultanee (concorrenza).
  const handleAssignCollaudo = async (vehicle, date) => {
    if (isReadOnly || !vehicle) return;
    setAssigning(true);
    const dateStr = toISO(date);
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, 'veicoli', vehicle.id);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('not-found');
        const current = snap.data();
        if (current.dataCollaudo || current.collaudo !== 'da-collaudare') {
          throw new Error('already-assigned');
        }
        tx.update(ref, { collaudo: 'pianificato', dataCollaudo: dateStr });
      });
      await logAction(userName, `Collaudo pianificato per il ${fmtDMY(dateStr)}`, {
        committente: vehicle.committente,
        numeroTelaio: vehicle.numeroTelaio
      });
      setAssignVehicle(null);
      setAssignSearchTerm('');
      if (selectedDay) {
        setSelectedDay({
          ...selectedDay,
          vehicles: [...selectedDay.vehicles, { ...vehicle, collaudo: 'pianificato', dataCollaudo: dateStr }]
        });
      }
      showToast('Collaudo pianificato per il veicolo selezionato', 'success');
    } catch (err) {
      console.error(err);
      if (err.message === 'already-assigned') {
        showToast('Il veicolo è già stato assegnato a un\'altra data nel frattempo. Riprova.', 'error');
      } else {
        showToast('Errore durante la pianificazione del collaudo', 'error');
      }
    } finally {
      setAssigning(false);
    }
  };

  // Veicoli senza data collaudo ma da collaudare
  const vehiclesNeedingDateSearch = searchTerm.trim()
    ? vehicles.filter(v => !v.dataCollaudo && v.collaudo === 'da-collaudare' && searchVehicle(v, searchTerm))
    : vehicles.filter(v => !v.dataCollaudo && v.collaudo === 'da-collaudare');

  const totalPending = vehicles.filter(v => v.collaudo === 'da-collaudare' && !v.dataCollaudo).length;
  const totalPlanned = vehicles.filter(v => v.collaudo === 'pianificato' || (v.collaudo === 'da-collaudare' && v.dataCollaudo)).length;
  const totalDone = vehicles.filter(v => v.collaudo === 'collaudo-eseguito').length;

  return (
    <div className="space-y-4">
      {/* HEADER */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <CheckSquare size={28} className="text-teal-600" />
            Gestione Collaudi
          </h2>
          <div className="flex gap-3 flex-wrap">
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 text-center">
              <div className="text-2xl font-bold text-orange-700">{totalPending}</div>
              <div className="text-xs text-orange-600">Da Collaudare</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-center">
              <div className="text-2xl font-bold text-blue-700">{totalPlanned}</div>
              <div className="text-xs text-blue-600">Pianificati</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-center">
              <div className="text-2xl font-bold text-green-700">{totalDone}</div>
              <div className="text-xs text-green-600">Completati</div>
            </div>
          </div>
        </div>

        {/* BARRA RICERCA */}
        <div className="mb-4 bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Search size={20} className="text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Cerca veicolo per committente, telaio, matricola, SAP, targa..."
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {searchTerm && (
              <button onClick={() => { setSearchTerm(''); setHighlightedVehicleId(null); }} className="text-gray-400 hover:text-gray-600 p-1">
                <X size={20} />
              </button>
            )}
          </div>
          {searchTerm && highlightedVehicleId && (
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
              ✓ Veicolo trovato nel calendario
            </div>
          )}
        </div>

        {/* NAVIGAZIONE MESE */}
        <div className="flex justify-between items-center mb-4">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft size={24} /></button>
          <h3 className="text-xl font-bold">{monthNames[currentMonth]} {currentYear}</h3>
          <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight size={24} /></button>
        </div>

        {/* HEADER GIORNI - Desktop */}
        <div className="hidden md:grid grid-cols-7 gap-2 mb-2">
          {dayNames.map(day => (
            <div key={day} className="text-center font-bold text-sm text-gray-600 p-2">{day}</div>
          ))}
        </div>

        {/* CALENDARIO - Desktop */}
        <div className="hidden md:grid md:grid-cols-7 gap-2">
          {daysInMonth.map((dayObj, index) => {
            const dayVehicles = dayObj.isCurrentMonth ? getVehiclesForDay(dayObj.date) : [];
            const isToday = dayObj.isCurrentMonth && dayObj.date.toDateString() === new Date().toDateString();
            return (
              <div
                key={index}
                className={'min-h-[100px] border rounded-lg p-2 ' +
                  (dayObj.isCurrentMonth ? 'bg-white cursor-pointer hover:bg-teal-50' : 'bg-gray-50') +
                  (isToday ? ' ring-2 ring-teal-500' : '')}
                onClick={() => { if (dayObj.isCurrentMonth) { setSelectedDay({ date: dayObj.date, vehicles: dayVehicles }); setAssignVehicle(null); setAssignSearchTerm(''); } }}
              >
                <div className={'text-sm font-semibold ' + (dayObj.isCurrentMonth ? 'text-gray-800' : 'text-gray-400')}>
                  {dayObj.date.getDate()}
                </div>
                {dayVehicles.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {dayVehicles.slice(0, 2).map(vehicle => {
                      const isHighlighted = vehicle.id === highlightedVehicleId;
                      const completed = isCollaudoCompleted(vehicle);
                      return (
                        <div
                          key={vehicle.id}
                          ref={isHighlighted ? highlightedRef : null}
                          className={'text-xs p-1 rounded border truncate ' + getBadgeColor(vehicle) +
                            (isHighlighted ? ' ring-2 ring-yellow-400 shadow-lg animate-pulse' : '') +
                            (completed ? ' opacity-75' : '')}
                        >
                          {completed && '✓ '}{vehicle.committente}
                        </div>
                      );
                    })}
                    {dayVehicles.length > 2 && (
                      <div className="text-xs text-gray-500">+{dayVehicles.length - 2} altri</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* CALENDARIO - Mobile */}
        <div className="md:hidden space-y-3">
          {daysInMonth.filter(d => d.isCurrentMonth).map((dayObj, index) => {
            const dayVehicles = getVehiclesForDay(dayObj.date);
            const isToday = dayObj.date.toDateString() === new Date().toDateString();
            const dayName = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'][dayObj.date.getDay()];
            return (
              <div
                key={index}
                className={`border-2 rounded-xl p-4 cursor-pointer active:scale-[0.98] hover:shadow-lg ${isToday ? 'border-teal-500 bg-teal-50' : 'border-gray-200 bg-white'}`}
                onClick={() => { setSelectedDay({ date: dayObj.date, vehicles: dayVehicles }); setAssignVehicle(null); setAssignSearchTerm(''); }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className={`text-2xl font-bold ${isToday ? 'text-teal-600' : 'text-gray-800'}`}>{dayObj.date.getDate()}</div>
                    <div className="text-sm text-gray-600">{dayName}</div>
                  </div>
                  {dayVehicles.length > 0 && (
                    <div className="bg-teal-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                      {dayVehicles.length}
                    </div>
                  )}
                </div>
                {dayVehicles.length > 0 && (
                  <div className="space-y-1">
                    {dayVehicles.map(vehicle => {
                      const isHighlighted = vehicle.id === highlightedVehicleId;
                      const completed = isCollaudoCompleted(vehicle);
                      return (
                        <div
                          key={vehicle.id}
                          ref={isHighlighted ? highlightedRef : null}
                          className={'border rounded-lg px-3 py-2 text-sm ' + getBadgeColor(vehicle) + (completed ? ' opacity-75' : '')}
                        >
                          <div className="font-semibold">{completed && '✓ '}{vehicle.committente}</div>
                          <div className="text-xs opacity-75">{getCollaudoLabel(vehicle)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* LEGENDA */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-orange-100 border-2 border-orange-400 rounded"></div><span>Da Collaudare / Pianificato</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-green-100 border-2 border-green-400 rounded"></div><span>Collaudo Eseguito ✓</span></div>
        </div>
      </div>

      {/* VEICOLI SENZA DATA COLLAUDO */}
      {vehiclesNeedingDateSearch.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertCircle size={24} className="text-orange-600" />
            <h3 className="text-xl font-bold">Senza Data Collaudo Pianificata</h3>
            <span className="bg-orange-600 text-white px-3 py-1 rounded-full text-sm font-bold">{vehiclesNeedingDateSearch.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {vehiclesNeedingDateSearch.map(vehicle => (
              <div
                key={vehicle.id}
                className="border-2 border-orange-200 rounded-lg p-3 bg-orange-50 hover:shadow-md transition-all"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1 cursor-pointer" onClick={() => onEditVehicle(vehicle)}>
                    <p className="font-bold text-gray-800">{vehicle.committente}</p>
                    <p className="text-xs text-gray-600">Telaio: {vehicle.numeroTelaio || 'N/A'}</p>
                    <p className="text-xs text-gray-600">Consegna: {fmtDMY(vehicle.dataConsegna)}</p>
                    {vehicle.tipoAllestimento && <p className="text-xs text-gray-500">{vehicle.tipoAllestimento}</p>}
                  </div>
                  <button onClick={() => onEditVehicle(vehicle)} className="p-1 text-blue-600 hover:bg-blue-50 rounded" title="Apri scheda">
                    <Eye size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL DETTAGLIO GIORNO */}
      {selectedDay && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-teal-700 text-white p-4 flex justify-between items-center sticky top-0 z-10">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <CheckSquare size={22} />
                Collaudi del {fmtDMY(toISO(selectedDay.date))}
              </h2>
              <button onClick={() => { setSelectedDay(null); setAssignVehicle(null); setAssignSearchTerm(''); }} className="text-white hover:bg-teal-800 rounded p-1"><X size={24} /></button>
            </div>
            <div className="p-4 space-y-3">
              {selectedDay.vehicles.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Nessun collaudo programmato per questo giorno.</p>
              ) : (
                selectedDay.vehicles.map(vehicle => {
                  const completed = isCollaudoCompleted(vehicle);
                  return (
                    <div
                      key={vehicle.id}
                      className={`border-2 rounded-lg p-4 transition-all ${completed ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            {completed
                              ? <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
                              : <AlertCircle size={18} className="text-orange-600 flex-shrink-0" />
                            }
                            <p className="font-bold text-lg">{vehicle.committente}</p>
                          </div>
                          <p className="text-sm text-gray-600">Telaio: {vehicle.numeroTelaio || 'N/A'}</p>
                          {vehicle.targa && <p className="text-sm text-gray-600">Targa: {vehicle.targa}</p>}
                          {vehicle.tipoAllestimento && <p className="text-sm text-gray-600">Tipo: {vehicle.tipoAllestimento}</p>}
                          <p className="text-sm mt-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getBadgeColor(vehicle)}`}>
                              {getCollaudoLabel(vehicle)}
                            </span>
                          </p>
                        </div>
                        <button
                          onClick={() => onEditVehicle(vehicle)}
                          className="text-blue-600 hover:bg-blue-50 p-2 rounded"
                          title="Apri scheda veicolo"
                        >
                          <Eye size={20} />
                        </button>
                      </div>

                      {/* AGGIORNAMENTO RAPIDO COLLAUDO */}
                      {!isReadOnly && (
                        <div className="border-t pt-3 mt-2">
                          <div className="flex flex-wrap gap-2">
                            {!completed ? (
                              <button
                                onClick={() => handleQuickUpdateCollaudo(vehicle, 'collaudo-eseguito')}
                                className="px-3 py-1.5 rounded-lg text-sm font-medium border bg-white text-green-700 border-green-300 hover:bg-green-50 transition-all"
                              >
                                ✅ Segna come Eseguito
                              </button>
                            ) : (
                              <button
                                onClick={() => handleQuickUpdateCollaudo(vehicle, 'pianificato')}
                                className="px-3 py-1.5 rounded-lg text-sm font-medium border bg-white text-orange-600 border-orange-300 hover:bg-orange-50 transition-all"
                              >
                                ↩ Ripristina Pianificato
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {/* ASSEGNAZIONE VEICOLO DA CALENDARIO */}
              {!isReadOnly && (
                <div className="border-t pt-4 mt-2">
                  <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                    <CalendarPlus size={18} className="text-teal-600" />
                    Assegna un veicolo a questo giorno
                  </h3>
                  <VehiclePickerList
                    vehicles={getUnplannedCollaudoVehicles(vehicles)}
                    selectedId={assignVehicle?.id}
                    onSelect={setAssignVehicle}
                    searchTerm={assignSearchTerm}
                    onSearchChange={setAssignSearchTerm}
                    emptyLabel="Nessun veicolo da collaudare in attesa di pianificazione"
                  />
                  <button
                    onClick={() => handleAssignCollaudo(assignVehicle, selectedDay.date)}
                    disabled={!assignVehicle || assigning}
                    className="mt-3 w-full bg-teal-600 text-white px-4 py-2.5 rounded-lg hover:bg-teal-700 disabled:bg-gray-300 font-medium"
                  >
                    {assigning ? 'Assegnazione in corso...' : `Pianifica collaudo per il ${fmtDMY(toISO(selectedDay.date))}`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollaudiPage;
