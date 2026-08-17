import { useState, useRef } from 'react';
import { Car, CalendarPlus, ChevronLeft, ChevronRight, Eye, Plus, Search, Settings, Wrench, X, Trash2 } from 'lucide-react';
import { updateDoc, doc, runTransaction } from 'firebase/firestore';
import { db, logAction, releaseParkingSpotForVehicle } from '../firebase';
import { useUser } from '../contexts/UserContext';
import { useNotification } from '../contexts/NotificationContext';
import { fmtDMY, toISO, getDaysInMonth } from '../utils/dateUtils';
import { useFilteredVehicles } from '../hooks/useFilteredVehicles';
import { ALL_MODALITA_RITIRO, getUnplannedPickupVehicles, RITIRO_MODALITA_LABELS } from '../utils/ritiroUtils';
import { searchVehicle } from '../utils/searchUtils';
import VehiclePickerList from '../components/Common/VehiclePickerList';

const PianificazioneRitiriPage = ({ vehicles, onEditVehicle, userName }) => {
  const { isReadOnly } = useUser();
  const { showToast, showConfirm } = useNotification();
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [selectedDay, setSelectedDay] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [modalitaRitiro, setModalitaRitiro] = useState('ritiro');
  const [tipoConsegna, setTipoConsegna] = useState('bisarca');
  const [searchTerm, setSearchTerm] = useState(''); // Ricerca globale pagina
  const [vehicleSearchTerm, setVehicleSearchTerm] = useState(''); // Ricerca nel select
  const [highlightedVehicleId, setHighlightedVehicleId] = useState(null);
  const [ritiroSvolto, setRitiroSvolto] = useState(false);
  const [noteRitiro, setNoteRitiro] = useState('');
  const [indirizzoConsegna, setIndirizzoConsegna] = useState('');
  const [editingRitiro, setEditingRitiro] = useState(null); // Veicolo in modifica
  const [clienteAvvisato, setClienteAvvisato] = useState(false);
  const [clienteAvvisatoData, setClienteAvvisatoData] = useState('');
  const [oraMontaggio, setOraMontaggio] = useState('');
  const [showMontaggiModal, setShowMontaggiModal] = useState(false);
  const [quickAssignVehicle, setQuickAssignVehicle] = useState(null);
  const [quickAssignSearchTerm, setQuickAssignSearchTerm] = useState('');
  const [quickAssignModalita, setQuickAssignModalita] = useState('');
  const [assigningQuick, setAssigningQuick] = useState(false);
  const highlightedRef = useRef(null);

  const resetQuickAssign = () => {
    setQuickAssignVehicle(null);
    setQuickAssignSearchTerm('');
    setQuickAssignModalita('');
  };

  // Auto-transizione a "ritirato" per appuntamenti montaggio scaduti:
  // gestita server-side da scripts/autoCompleteMontaggiAppuntamenti.js
  // (cron GitHub Actions ogni 15 minuti, vedi
  // .github/workflows/auto-complete-montaggi.yml). In precedenza era un
  // useEffect client-side che iterava tutti i veicoli ad ogni render di
  // questa pagina (hotspot §6.4 di ARCHITETTURA_SSV_MANAGER.md).

  // Helper: colore badge calendario — solo 2 distinzioni: montaggio vs ritiro/consegna
  // Se completato (ritiroSvolto) → verde-grigio con ✓
  const getBadgeColor = (vehicle) => {
    if (vehicle.ritiroSvolto) return 'bg-gray-100 border-gray-300 text-gray-500';
    if (vehicle.modalitaRitiro === 'montaggio') return 'bg-purple-100 border-purple-300 text-purple-700';
    return 'bg-orange-100 border-orange-300 text-orange-700';
  };

  // Helper: etichetta modalità
  const getModalitaLabel = (vehicle) => {
    if (vehicle.modalitaRitiro === 'montaggio') return `🔧 Montaggio${vehicle.oraMontaggio ? ' ore ' + vehicle.oraMontaggio : ''}`;
    if (vehicle.modalitaRitiro === 'ritiro') return '📦 Ritiro del Mezzo';
    return vehicle.tipoConsegna === 'bisarca' ? '🚛 Consegna con Bisarca' : '🚗 Consegna con Driver';
  };

  // Lista appuntamenti montaggio ordinati per data+ora
  const montaggiSorted = vehicles
    .filter(v => v.modalitaRitiro === 'montaggio' && v.oraMontaggio)
    .sort((a, b) => ((a.dataRitiro || '') + (a.oraMontaggio || '')).localeCompare((b.dataRitiro || '') + (b.oraMontaggio || '')));

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const monthNames = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const dayNames = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  const vehiclesReady = useFilteredVehicles(vehicles, ['pronto']);

  // Funzione ricerca come File Montaggi
  const handleSearch = (term) => {
    setSearchTerm(term);
    setHighlightedVehicleId(null);

    if (!term.trim()) return;

    const foundVehicle = vehicles.find(v => searchVehicle(v, term));

    if (foundVehicle) {
      setHighlightedVehicleId(foundVehicle.id);

      // Naviga al mese del ritiro se presente
      if (foundVehicle.dataRitiro) {
        const ritiroDate = new Date(foundVehicle.dataRitiro);
        setCurrentMonth(ritiroDate.getMonth());
        setCurrentYear(ritiroDate.getFullYear());
      }

      // Scroll al veicolo evidenziato
      setTimeout(() => {
        if (highlightedRef.current) {
          highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  };

  const clearSearch = () => {
    setSearchTerm('');
    setHighlightedVehicleId(null);
  };

  const getVehiclesForDay = (date) => {
    const dateStr = toISO(date);
    let dayVehicles = vehicles.filter(v => v.dataRitiro === dateStr);

    // Filtra in base alla ricerca
    if (searchTerm.trim()) {
      dayVehicles = dayVehicles.filter(v => searchVehicle(v, searchTerm));
    }

    return dayVehicles;
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

  const handleAssignVehicle = async () => {
    if (!selectedVehicle || !selectedDay) return;

    try {
      const updateData = {
        dataRitiro: toISO(selectedDay.date),
        modalitaRitiro,
        tipoConsegna: modalitaRitiro === 'consegna' ? tipoConsegna : null,
        oraMontaggio: modalitaRitiro === 'montaggio' ? oraMontaggio : '',
        ritiroSvolto: ritiroSvolto,
        noteRitiro: noteRitiro || '',
        indirizzoConsegna: modalitaRitiro === 'consegna' ? indirizzoConsegna : '',
        clienteAvvisato: { si: clienteAvvisato, data: clienteAvvisato ? clienteAvvisatoData : '' }
      };

      updateData.statoRitiro = 'pianificato';

      await updateDoc(doc(db, 'veicoli', selectedVehicle.id), updateData);
      await logAction(userName, 'Assegnato ritiro/consegna', {
        committente: selectedVehicle.committente,
        numeroTelaio: selectedVehicle.numeroTelaio
      });

      // Reset TUTTI i campi del modal
      setShowAssignModal(false);
      setSelectedVehicle(null);
      setSelectedDay(null);
      setVehicleSearchTerm('');
      setModalitaRitiro('ritiro');
      setTipoConsegna('bisarca');
      setOraMontaggio('');
      setRitiroSvolto(false);
      setNoteRitiro('');
      setIndirizzoConsegna('');
      setClienteAvvisato(false);
      setClienteAvvisatoData('');
    } catch (error) {
      console.error('Errore:', error);
      showToast('Errore durante assegnazione.', 'error');
    }
  };

  const handleEditRitiro = (vehicle) => {
    setEditingRitiro(vehicle);
    setModalitaRitiro(vehicle.modalitaRitiro || 'ritiro');
    setTipoConsegna(vehicle.tipoConsegna || 'bisarca');
    setOraMontaggio(vehicle.oraMontaggio || '');
    setRitiroSvolto(vehicle.ritiroSvolto || false);
    setNoteRitiro(vehicle.noteRitiro || '');
    setIndirizzoConsegna(vehicle.indirizzoConsegna || '');
    setClienteAvvisato(vehicle.clienteAvvisato?.si || false);
    setClienteAvvisatoData(vehicle.clienteAvvisato?.data || '');

    // Mantieni selectedDay con vehicles per evitare crash al ritorno
    const ritiroDate = new Date(vehicle.dataRitiro);
    const dayVehicles = getVehiclesForDay(ritiroDate);
    setSelectedDay({ date: ritiroDate, vehicles: dayVehicles });
  };

  const handleUpdateRitiro = async () => {
    if (!editingRitiro) return;

    try {
      const updateData = {
        dataRitiro: toISO(selectedDay.date),
        modalitaRitiro,
        tipoConsegna: modalitaRitiro === 'consegna' ? tipoConsegna : null,
        oraMontaggio: modalitaRitiro === 'montaggio' ? oraMontaggio : '',
        ritiroSvolto: ritiroSvolto,
        noteRitiro: noteRitiro || '',
        indirizzoConsegna: modalitaRitiro === 'consegna' ? indirizzoConsegna : '',
        clienteAvvisato: { si: clienteAvvisato, data: clienteAvvisato ? clienteAvvisatoData : '' },
        statoRitiro: ritiroSvolto ? 'svolto' : 'pianificato'
      };

      await updateDoc(doc(db, 'veicoli', editingRitiro.id), updateData);
      await logAction(userName, 'Modificato ritiro/consegna', {
        committente: editingRitiro.committente,
        numeroTelaio: editingRitiro.numeroTelaio
      });

      // Aggiorna vehicles in selectedDay per riflettere le modifiche
      const updatedVehicles = getVehiclesForDay(selectedDay.date);
      setSelectedDay({ date: selectedDay.date, vehicles: updatedVehicles });

      // Reset campi ma mantieni selectedDay per tornare al modal giorno
      setEditingRitiro(null);
      setModalitaRitiro('ritiro');
      setTipoConsegna('bisarca');
      setRitiroSvolto(false);
      setNoteRitiro('');
      setIndirizzoConsegna('');
    } catch (error) {
      console.error('Errore:', error);
      showToast('Errore durante aggiornamento.', 'error');
    }
  };

  const handleCancelEdit = () => {
    // Reset campi ma mantieni selectedDay per tornare al modal giorno
    setEditingRitiro(null);
    setModalitaRitiro('ritiro');
    setTipoConsegna('bisarca');
    setOraMontaggio('');
    setRitiroSvolto(false);
    setNoteRitiro('');
    setIndirizzoConsegna('');
    setClienteAvvisato(false);
    setClienteAvvisatoData('');
  };

  const handleQuickUpdateRitiroSvolto = async (vehicle, checked) => {
    if (isReadOnly) return;
    try {
      const updateData = { ritiroSvolto: checked, statoRitiro: checked ? 'svolto' : 'pianificato' };
      const becomesRitirato = checked && vehicle.status === 'pronto';
      if (becomesRitirato) updateData.status = 'ritirato';
      if (!checked && vehicle.status === 'ritirato') updateData.status = 'pronto';

      await updateDoc(doc(db, 'veicoli', vehicle.id), updateData);
      await logAction(userName, checked ? 'Ritiro/Consegna segnato come svolto' : 'Ritiro/Consegna segnato come non svolto', {
        committente: vehicle.committente,
        numeroTelaio: vehicle.numeroTelaio
      });

      // Libera automaticamente la posizione parcheggio quando il veicolo diventa "ritirato"
      // (stesso helper condiviso usato da useVehicleCrud.handleSaveVehicle)
      if (becomesRitirato) {
        const freed = await releaseParkingSpotForVehicle(vehicle.id);
        if (freed) {
          await logAction(userName, 'Parcheggio liberato automaticamente (veicolo ritirato)', {
            committente: vehicle.committente,
            numeroTelaio: vehicle.numeroTelaio
          });
        }
      }

      const updatedVehicles = selectedDay.vehicles.map(v =>
        v.id === vehicle.id ? { ...v, ...updateData } : v
      );
      setSelectedDay({ date: selectedDay.date, vehicles: updatedVehicles });
    } catch (error) {
      console.error('Errore:', error);
      showToast('Errore durante aggiornamento.', 'error');
    }
  };

  const handleQuickUpdateClienteAvvisato = async (vehicle, checked, data) => {
    if (isReadOnly) return;
    try {
      const updateData = { clienteAvvisato: { si: checked, data: checked ? data : '' } };

      await updateDoc(doc(db, 'veicoli', vehicle.id), updateData);
      await logAction(userName, 'Cliente avvisato aggiornato', {
        committente: vehicle.committente,
        numeroTelaio: vehicle.numeroTelaio
      });

      const updatedVehicles = selectedDay.vehicles.map(v =>
        v.id === vehicle.id ? { ...v, ...updateData } : v
      );
      setSelectedDay({ date: selectedDay.date, vehicles: updatedVehicles });
    } catch (error) {
      console.error('Errore:', error);
      showToast('Errore durante aggiornamento.', 'error');
    }
  };

  const handleDeleteRitiro = async (vehicle) => {
    if (!await showConfirm(`Eliminare la pianificazione del ritiro/consegna per ${vehicle.committente}?`)) return;

    try {
      const updateData = {
        dataRitiro: '',
        modalitaRitiro: '',
        tipoConsegna: null,
        oraMontaggio: '',
        ritiroSvolto: false,
        noteRitiro: '',
        indirizzoConsegna: '',
        clienteAvvisato: { si: false, data: '' },
        statoRitiro: 'da-pianificare'
      };

      await updateDoc(doc(db, 'veicoli', vehicle.id), updateData);
      await logAction(userName, 'Eliminato ritiro/consegna', {
        committente: vehicle.committente,
        numeroTelaio: vehicle.numeroTelaio
      });

      // Aggiorna vehicles in selectedDay per riflettere le modifiche
      const updatedVehicles = getVehiclesForDay(selectedDay.date);
      setSelectedDay({ date: selectedDay.date, vehicles: updatedVehicles });

      // Chiudi il modal se non ci sono più veicoli
      if (updatedVehicles.length === 0) {
        setSelectedDay(null);
      }
    } catch (error) {
      console.error('Errore:', error);
      showToast('Errore durante eliminazione ritiro.', 'error');
    }
  };

  // Assegnazione veicolo da calendario: click su un giorno -> scelta di un
  // veicolo "pronto" ancora senza ritiro pianificato + modalità (solo tra
  // quelle consentite per quel veicolo) -> dataRitiro/modalitaRitiro/
  // statoRitiro='pianificato'. Usa una transazione Firestore per evitare
  // doppia assegnazione dello stesso veicolo in scritture quasi simultanee.
  const handleQuickAssignRitiro = async (date) => {
    if (isReadOnly || !quickAssignVehicle || !quickAssignModalita) return;
    setAssigningQuick(true);
    const dateStr = toISO(date);
    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, 'veicoli', quickAssignVehicle.id);
        const snap = await tx.get(ref);
        if (!snap.exists()) throw new Error('not-found');
        const current = snap.data();
        if (current.dataRitiro || current.status !== 'pronto') {
          throw new Error('already-assigned');
        }
        tx.update(ref, {
          dataRitiro: dateStr,
          modalitaRitiro: quickAssignModalita,
          statoRitiro: 'pianificato',
          tipoConsegna: quickAssignModalita === 'consegna' ? 'bisarca' : null,
        });
      });
      await logAction(userName, 'Ritiro/consegna pianificato da calendario', {
        committente: quickAssignVehicle.committente,
        numeroTelaio: quickAssignVehicle.numeroTelaio
      });
      resetQuickAssign();
      if (selectedDay) {
        setSelectedDay({
          ...selectedDay,
          vehicles: [...selectedDay.vehicles, {
            ...quickAssignVehicle,
            dataRitiro: dateStr,
            modalitaRitiro: quickAssignModalita,
            statoRitiro: 'pianificato',
          }]
        });
      }
      showToast('Ritiro/consegna pianificato per il veicolo selezionato', 'success');
    } catch (error) {
      console.error('Errore:', error);
      if (error.message === 'already-assigned') {
        showToast('Il veicolo è già stato assegnato a un\'altra data nel frattempo. Riprova.', 'error');
      } else {
        showToast('Errore durante la pianificazione del ritiro.', 'error');
      }
    } finally {
      setAssigningQuick(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Car size={28} className="text-blue-600" />
            Pianificazione Ritiri e Consegne
          </h2>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowMontaggiModal(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 flex items-center gap-2"
            >
              <Wrench size={20} />
              <span className="hidden sm:inline">Appuntamenti Montaggi</span>
              <span className="sm:hidden">Montaggi</span>
              {montaggiSorted.filter(v => !v.ritiroSvolto).length > 0 && (
                <span className="bg-white text-purple-700 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {montaggiSorted.filter(v => !v.ritiroSvolto).length}
                </span>
              )}
            </button>
            {!isReadOnly && (
              <button
                onClick={() => { setShowAssignModal(true); setSelectedDay({ date: new Date() }); }}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus size={20} />
                <span className="hidden sm:inline">Inserisci Nuovo Ritiro/Consegna</span>
                <span className="sm:hidden">Nuovo</span>
              </button>
            )}
          </div>
        </div>

        {/* BARRA DI RICERCA */}
        <div className="mb-4 bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-2">
            <Search size={20} className="text-gray-400" />
            <input
              type="text"
              placeholder="Cerca veicolo per committente, telaio, matricola o targa..."
              className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
            {searchTerm && (
              <button
                onClick={clearSearch}
                className="text-gray-400 hover:text-gray-600 p-1"
                title="Pulisci ricerca"
              >
                <X size={20} />
              </button>
            )}
          </div>
          {searchTerm && highlightedVehicleId && (
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
              ✓ Trovato veicolo - mostrando solo risultati corrispondenti
            </div>
          )}
        </div>

        <div className="flex justify-between items-center mb-4">
          <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft size={24} />
          </button>
          <h3 className="text-xl font-bold">{monthNames[currentMonth]} {currentYear}</h3>
          <button onClick={handleNextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight size={24} />
          </button>
        </div>

        {/* Header giorni - Desktop */}
        <div className="hidden md:grid grid-cols-7 gap-2 mb-2">
          {dayNames.map(day => (
            <div key={day} className="text-center font-bold text-sm text-gray-600 p-2">{day}</div>
          ))}
        </div>

        {/* Calendario Desktop */}
        <div className="hidden md:grid md:grid-cols-7 gap-2">
          {daysInMonth.map((dayObj, index) => {
            const dayVehicles = dayObj.isCurrentMonth ? getVehiclesForDay(dayObj.date) : [];
            const isToday = dayObj.isCurrentMonth && dayObj.date.toDateString() === new Date().toDateString();

            return (
              <div
                key={index}
                className={'min-h-[100px] border rounded-lg p-2 ' + (dayObj.isCurrentMonth ? 'bg-white cursor-pointer hover:bg-blue-50' : 'bg-gray-50') + (isToday ? ' ring-2 ring-blue-500' : '')}
                onClick={() => { if (dayObj.isCurrentMonth) { setSelectedDay({ date: dayObj.date, vehicles: dayVehicles }); resetQuickAssign(); } }}
              >
                <div className={'text-sm font-semibold ' + (dayObj.isCurrentMonth ? 'text-gray-800' : 'text-gray-400')}>
                  {dayObj.date.getDate()}
                </div>
                {dayVehicles.length > 0 && (
                  <div className="mt-1 space-y-1">
                    {dayVehicles.slice(0, 2).map(vehicle => {
                      const bgColor = getBadgeColor(vehicle);
                      const isHighlighted = vehicle.id === highlightedVehicleId;
                      return (
                        <div
                          key={vehicle.id}
                          ref={isHighlighted ? highlightedRef : null}
                          className={'text-xs p-1 rounded border truncate ' + bgColor + (isHighlighted ? ' ring-2 ring-yellow-400 shadow-lg animate-pulse' : '')}
                        >
                          {vehicle.ritiroSvolto && '✓ '}{vehicle.committente}
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

        {/* Vista Mobile - Lista giorni */}
        <div className="md:hidden space-y-3">
          {daysInMonth.filter(dayObj => dayObj.isCurrentMonth).map((dayObj, index) => {
            const dayVehicles = getVehiclesForDay(dayObj.date);
            const isToday = dayObj.date.toDateString() === new Date().toDateString();
            const dayName = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'][dayObj.date.getDay()];

            return (
              <div
                key={index}
                className={`border-2 rounded-xl p-4 transition-all cursor-pointer active:scale-[0.98] hover:shadow-lg ${isToday ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-400' : 'border-gray-200 bg-white'}`}
                onClick={() => { setSelectedDay({ date: dayObj.date, vehicles: dayVehicles }); resetQuickAssign(); }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className={`text-2xl font-bold ${isToday ? 'text-blue-600' : 'text-gray-800'}`}>
                      {dayObj.date.getDate()}
                    </div>
                    <div className="text-sm text-gray-600">{dayName}</div>
                  </div>
                  {dayVehicles.length > 0 && (
                    <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                      {dayVehicles.length}
                    </div>
                  )}
                </div>

                {dayVehicles.length > 0 && (
                  <div className="space-y-2">
                    {dayVehicles.map(vehicle => {
                      const bgColor = getBadgeColor(vehicle);
                      const isHighlighted = vehicle.id === highlightedVehicleId;
                      return (
                        <div
                          key={vehicle.id}
                          ref={isHighlighted ? highlightedRef : null}
                          className={`${bgColor} border-2 rounded-lg px-3 py-2${isHighlighted ? ' ring-4 ring-yellow-400 shadow-xl animate-pulse' : ''}`}
                        >
                          <div className="font-semibold text-sm">{vehicle.ritiroSvolto && '✓ '}{vehicle.committente}</div>
                          <div className="text-xs opacity-75 mt-0.5">{getModalitaLabel(vehicle)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {dayVehicles.length === 0 && isToday && (
                  <p className="text-sm text-gray-500 italic">Nessun ritiro/consegna programmato</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-orange-100 border-2 border-orange-300 rounded"></div><span>Ritiro / Consegna</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-purple-100 border-2 border-purple-300 rounded"></div><span>Appuntamento Montaggio</span></div>
          <div className="flex items-center gap-2"><div className="w-4 h-4 bg-gray-100 border-2 border-gray-300 rounded"></div><span>Completato ✓</span></div>
        </div>
      </div>

      {selectedDay && !showAssignModal && !editingRitiro && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">{fmtDMY(toISO(selectedDay.date))}</h2>
              <button onClick={() => { setSelectedDay(null); resetQuickAssign(); }} className="text-white hover:bg-blue-700 rounded p-1"><X size={24} /></button>
            </div>
            <div className="p-4">
              {selectedDay.vehicles.length === 0 ? (
                <p className="text-gray-500">Nessun ritiro/consegna programmato per questo giorno.</p>
              ) : (
                <div className="space-y-3">
                  {selectedDay.vehicles.map(vehicle => (
                    <div key={vehicle.id} className="border-2 rounded-lg p-4 hover:bg-gray-50 transition-all">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <p className="font-bold text-lg">{vehicle.committente}</p>
                          <p className="text-sm text-gray-600">Telaio: {vehicle.numeroTelaio}</p>
                          <p className="text-sm text-gray-600 mt-1">{getModalitaLabel(vehicle)}</p>
                        </div>
                        <div className="flex gap-2">
                          {!isReadOnly && (
                            <button
                              onClick={() => handleEditRitiro(vehicle)}
                              className="text-orange-600 hover:bg-orange-50 p-2 rounded"
                              title="Modifica dati ritiro"
                            >
                              <Settings size={20} />
                            </button>
                          )}
                          <button
                            onClick={() => onEditVehicle(vehicle)}
                            className="text-blue-600 hover:bg-blue-50 p-2 rounded"
                            title="Vedi scheda veicolo"
                          >
                            <Eye size={20} />
                          </button>
                          {!isReadOnly && (
                            <button
                              onClick={() => handleDeleteRitiro(vehicle)}
                              className="text-red-600 hover:bg-red-50 p-2 rounded"
                              title="Elimina pianificazione ritiro"
                            >
                              <Trash2 size={20} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* INDIRIZZO CONSEGNA */}
                      {vehicle.indirizzoConsegna && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                          <p className="text-sm font-semibold text-blue-800 mb-1">📍 Indirizzo di Consegna:</p>
                          <p className="text-sm text-blue-900">{vehicle.indirizzoConsegna}</p>
                        </div>
                      )}

                      {/* RITIRO SVOLTO + CLIENTE AVVISATO */}
                      <div className="mt-3 space-y-2">
                        {!isReadOnly ? (
                          <>
                            <label className="flex items-center gap-3 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={vehicle.ritiroSvolto || false}
                                onChange={(e) => handleQuickUpdateRitiroSvolto(vehicle, e.target.checked)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-5 h-5 rounded accent-green-600"
                              />
                              <span className={`text-sm font-medium ${vehicle.ritiroSvolto ? 'text-green-700' : 'text-yellow-700'}`}>
                                {vehicle.ritiroSvolto ? '✅ Ritiro/Consegna Completato' : '⏳ Ritiro/Consegna In Attesa'}
                              </span>
                            </label>
                            {vehicle.modalitaRitiro === 'montaggio' && (
                              <label className="flex items-center gap-3 cursor-pointer select-none bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={vehicle.ritiroSvolto || false}
                                  onChange={(e) => handleQuickUpdateRitiroSvolto(vehicle, e.target.checked)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-5 h-5 rounded accent-purple-600"
                                />
                                <div>
                                  <span className={`text-sm font-medium ${vehicle.ritiroSvolto ? 'text-purple-700' : 'text-purple-900'}`}>
                                    {vehicle.ritiroSvolto ? '✅ Appuntamento Montaggio Completato' : '🔧 Appuntamento Montaggio in Attesa'}
                                  </span>
                                  {vehicle.oraMontaggio && (
                                    <span className="text-xs text-purple-600 ml-2">ore {vehicle.oraMontaggio}</span>
                                  )}
                                </div>
                              </label>
                            )}
                            <div className="flex items-center gap-3 flex-wrap">
                              <label className="flex items-center gap-3 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={vehicle.clienteAvvisato?.si || false}
                                  onChange={(e) => handleQuickUpdateClienteAvvisato(vehicle, e.target.checked, vehicle.clienteAvvisato?.data || '')}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-5 h-5 rounded accent-blue-600"
                                />
                                <span className={`text-sm font-medium ${vehicle.clienteAvvisato?.si ? 'text-blue-700' : 'text-gray-600'}`}>
                                  📞 Cliente Avvisato
                                </span>
                              </label>
                              {vehicle.clienteAvvisato?.si && (
                                <input
                                  type="date"
                                  className="border border-gray-300 rounded px-2 py-1 text-sm"
                                  value={vehicle.clienteAvvisato.data || ''}
                                  onChange={(e) => handleQuickUpdateClienteAvvisato(vehicle, true, e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${vehicle.ritiroSvolto ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-yellow-100 text-yellow-700 border border-yellow-300'}`}>
                              {vehicle.ritiroSvolto ? '✅ Completato' : '⏳ In Attesa'}
                            </span>
                            {vehicle.modalitaRitiro === 'montaggio' && vehicle.oraMontaggio && (
                              <span className="px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-700 border border-purple-300">
                                🔧 Montaggio ore {vehicle.oraMontaggio}{vehicle.ritiroSvolto ? ' ✓' : ''}
                              </span>
                            )}
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${vehicle.clienteAvvisato?.si ? 'bg-blue-100 text-blue-700 border border-blue-300' : 'bg-gray-100 text-gray-600 border border-gray-300'}`}>
                              {vehicle.clienteAvvisato?.si ? `📞 Cliente avvisato${vehicle.clienteAvvisato.data ? ` (${fmtDMY(vehicle.clienteAvvisato.data)})` : ''}` : 'Cliente non avvisato'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* NOTE */}
                      {vehicle.noteRitiro && (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-3">
                          <p className="text-sm font-semibold text-gray-700 mb-1">📝 Note:</p>
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">{vehicle.noteRitiro}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ASSEGNAZIONE VEICOLO DA CALENDARIO */}
              {!isReadOnly && (
                <div className="border-t pt-4 mt-4">
                  <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                    <CalendarPlus size={18} className="text-blue-600" />
                    Assegna un veicolo pronto a questo giorno
                  </h3>
                  <VehiclePickerList
                    vehicles={getUnplannedPickupVehicles(vehicles)}
                    selectedId={quickAssignVehicle?.id}
                    onSelect={(v) => {
                      setQuickAssignVehicle(v);
                      setQuickAssignModalita(v ? ALL_MODALITA_RITIRO[0] : '');
                    }}
                    searchTerm={quickAssignSearchTerm}
                    onSearchChange={setQuickAssignSearchTerm}
                    emptyLabel="Nessun veicolo pronto in attesa di pianificazione"
                  />
                  {quickAssignVehicle && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium mb-2">Modalità</label>
                      <div className="flex flex-wrap gap-3">
                        {ALL_MODALITA_RITIRO.map(opt => (
                          <label key={opt} className="flex items-center gap-2 cursor-pointer border rounded-lg px-3 py-2 hover:bg-gray-50">
                            <input
                              type="radio"
                              name="quickAssignModalita"
                              value={opt}
                              checked={quickAssignModalita === opt}
                              onChange={(e) => setQuickAssignModalita(e.target.value)}
                            />
                            <span className="text-sm font-medium">{RITIRO_MODALITA_LABELS[opt]}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <button
                    onClick={() => handleQuickAssignRitiro(selectedDay.date)}
                    disabled={!quickAssignVehicle || !quickAssignModalita || assigningQuick}
                    className="mt-3 w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 font-medium"
                  >
                    {assigningQuick ? 'Assegnazione in corso...' : `Pianifica ritiro/consegna per il ${fmtDMY(toISO(selectedDay.date))}`}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-blue-600 text-white p-4 flex justify-between items-center sticky top-0 z-10">
              <h2 className="text-xl font-bold">Assegna Ritiro/Consegna</h2>
              <button
                onClick={() => {
                  setShowAssignModal(false);
                  setSelectedVehicle(null);
                  setSelectedDay(null);
                  setVehicleSearchTerm('');
                  setModalitaRitiro('ritiro');
                  setTipoConsegna('bisarca');
                  setOraMontaggio('');
                  setRitiroSvolto(false);
                  setNoteRitiro('');
                  setIndirizzoConsegna('');
                  setClienteAvvisato(false);
                  setClienteAvvisatoData('');
                }}
                className="text-white hover:bg-blue-700 rounded p-1"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* SELEZIONE VEICOLO CON RICERCA */}
              <div>
                <label className="block text-sm font-medium mb-2">Seleziona Veicolo</label>
                <VehiclePickerList
                  vehicles={vehiclesReady}
                  selectedId={selectedVehicle?.id}
                  onSelect={setSelectedVehicle}
                  searchTerm={vehicleSearchTerm}
                  onSearchChange={setVehicleSearchTerm}
                />
              </div>

              {/* DATA */}
              <div>
                <label className="block text-sm font-medium mb-2">Data Ritiro/Consegna</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  value={selectedDay ? toISO(selectedDay.date) : ''}
                  onChange={(e) => setSelectedDay({ date: new Date(e.target.value + 'T12:00:00') })}
                />
              </div>

              {/* MODALITÀ */}
              <div>
                <label className="block text-sm font-medium mb-2">Modalità</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input type="radio" value="ritiro" checked={modalitaRitiro === 'ritiro'} onChange={(e) => setModalitaRitiro(e.target.value)} />
                    <span>Ritiro del Mezzo</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" value="consegna" checked={modalitaRitiro === 'consegna'} onChange={(e) => setModalitaRitiro(e.target.value)} />
                    <span>Veicolo da Consegnare</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" value="montaggio" checked={modalitaRitiro === 'montaggio'} onChange={(e) => setModalitaRitiro(e.target.value)} />
                    <span className="font-medium text-purple-800">🔧 Appuntamento per Montaggio</span>
                  </label>
                </div>
              </div>

              {/* ORA MONTAGGIO */}
              {modalitaRitiro === 'montaggio' && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <label className="block text-sm font-medium mb-2 text-purple-900">
                    Ora dell'Appuntamento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    className="w-full border border-purple-300 rounded-lg px-3 py-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                    value={oraMontaggio}
                    onChange={(e) => setOraMontaggio(e.target.value)}
                  />
                </div>
              )}

              {/* TIPO CONSEGNA */}
              {modalitaRitiro === 'consegna' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Tipo Consegna</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input type="radio" value="bisarca" checked={tipoConsegna === 'bisarca'} onChange={(e) => setTipoConsegna(e.target.value)} />
                        <span>Consegna con Bisarca</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="radio" value="driver" checked={tipoConsegna === 'driver'} onChange={(e) => setTipoConsegna(e.target.value)} />
                        <span>Consegna con Servizio Driver</span>
                      </label>
                    </div>
                  </div>

                  {/* INDIRIZZO CONSEGNA */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Indirizzo di Consegna</label>
                    <textarea
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      rows="2"
                      placeholder="Inserisci indirizzo completo di consegna..."
                      value={indirizzoConsegna}
                      onChange={(e) => setIndirizzoConsegna(e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* RITIRO SVOLTO */}
              <div className="border-t pt-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={ritiroSvolto}
                    onChange={(e) => setRitiroSvolto(e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-sm font-medium">Ritiro/Consegna Svolto</span>
                </label>
              </div>

              {/* CLIENTE AVVISATO */}
              <div className="border-t pt-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={clienteAvvisato}
                    onChange={(e) => setClienteAvvisato(e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-sm font-medium">Cliente Avvisato</span>
                </label>
                {clienteAvvisato && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium mb-1">Data Avviso</label>
                    <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2" value={clienteAvvisatoData} onChange={(e) => setClienteAvvisatoData(e.target.value)} />
                  </div>
                )}
              </div>

              {/* NOTE */}
              <div>
                <label className="block text-sm font-medium mb-2">Note</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  rows="3"
                  placeholder="Inserisci eventuali note..."
                  value={noteRitiro}
                  onChange={(e) => setNoteRitiro(e.target.value)}
                />
              </div>

              {/* PULSANTI */}
              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleAssignVehicle}
                  disabled={!selectedVehicle || !selectedDay}
                  className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 font-medium"
                >
                  Conferma Assegnazione
                </button>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedVehicle(null);
                    setSelectedDay(null);
                    setVehicleSearchTerm('');
                    setModalitaRitiro('ritiro');
                    setTipoConsegna('bisarca');
                    setOraMontaggio('');
                    setRitiroSvolto(false);
                    setNoteRitiro('');
                    setIndirizzoConsegna('');
                    setClienteAvvisato(false);
                    setClienteAvvisatoData('');
                  }}
                  className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL MODIFICA RITIRO */}
      {editingRitiro && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-orange-600 text-white p-4 flex justify-between items-center sticky top-0 z-10">
              <h2 className="text-xl font-bold">Modifica Ritiro/Consegna - {editingRitiro.committente}</h2>
              <button
                onClick={handleCancelEdit}
                className="text-white hover:bg-orange-700 rounded p-1"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* DATA */}
              <div>
                <label className="block text-sm font-medium mb-2">Data Ritiro/Consegna</label>
                <input
                  type="date"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  value={selectedDay ? toISO(selectedDay.date) : ''}
                  onChange={(e) => setSelectedDay({ date: new Date(e.target.value + 'T12:00:00') })}
                />
              </div>

              {/* MODALITÀ */}
              <div>
                <label className="block text-sm font-medium mb-2">Modalità</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input type="radio" value="ritiro" checked={modalitaRitiro === 'ritiro'} onChange={(e) => setModalitaRitiro(e.target.value)} />
                    <span>Ritiro del Mezzo</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" value="consegna" checked={modalitaRitiro === 'consegna'} onChange={(e) => setModalitaRitiro(e.target.value)} />
                    <span>Veicolo da Consegnare</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="radio" value="montaggio" checked={modalitaRitiro === 'montaggio'} onChange={(e) => setModalitaRitiro(e.target.value)} />
                    <span className="font-medium text-purple-800">🔧 Appuntamento per Montaggio</span>
                  </label>
                </div>
              </div>

              {/* ORA MONTAGGIO */}
              {modalitaRitiro === 'montaggio' && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <label className="block text-sm font-medium mb-2 text-purple-900">
                    Ora dell'Appuntamento <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    className="w-full border border-purple-300 rounded-lg px-3 py-2 focus:border-purple-500 focus:ring-2 focus:ring-purple-200"
                    value={oraMontaggio}
                    onChange={(e) => setOraMontaggio(e.target.value)}
                  />
                </div>
              )}

              {/* TIPO CONSEGNA */}
              {modalitaRitiro === 'consegna' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">Tipo Consegna</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input type="radio" value="bisarca" checked={tipoConsegna === 'bisarca'} onChange={(e) => setTipoConsegna(e.target.value)} />
                        <span>Consegna con Bisarca</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="radio" value="driver" checked={tipoConsegna === 'driver'} onChange={(e) => setTipoConsegna(e.target.value)} />
                        <span>Consegna con Servizio Driver</span>
                      </label>
                    </div>
                  </div>

                  {/* INDIRIZZO CONSEGNA */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Indirizzo di Consegna</label>
                    <textarea
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      rows="2"
                      placeholder="Inserisci indirizzo completo di consegna..."
                      value={indirizzoConsegna}
                      onChange={(e) => setIndirizzoConsegna(e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* RITIRO SVOLTO */}
              <div className="border-t pt-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={ritiroSvolto}
                    onChange={(e) => setRitiroSvolto(e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-sm font-medium">Ritiro/Consegna Svolto</span>
                </label>
              </div>

              {/* CLIENTE AVVISATO */}
              <div className="border-t pt-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={clienteAvvisato}
                    onChange={(e) => setClienteAvvisato(e.target.checked)}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-sm font-medium">Cliente Avvisato</span>
                </label>
                {clienteAvvisato && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium mb-1">Data Avviso</label>
                    <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2" value={clienteAvvisatoData} onChange={(e) => setClienteAvvisatoData(e.target.value)} />
                  </div>
                )}
              </div>

              {/* NOTE */}
              <div>
                <label className="block text-sm font-medium mb-2">Note</label>
                <textarea
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  rows="3"
                  placeholder="Inserisci eventuali note..."
                  value={noteRitiro}
                  onChange={(e) => setNoteRitiro(e.target.value)}
                />
              </div>

              {/* PULSANTI */}
              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleUpdateRitiro}
                  className="flex-1 bg-orange-600 text-white px-4 py-3 rounded-lg hover:bg-orange-700 font-medium"
                >
                  Salva Modifiche
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LISTA APPUNTAMENTI MONTAGGI */}
      {showMontaggiModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] overflow-y-auto">
            <div className="bg-purple-700 text-white p-4 flex justify-between items-center sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Wrench size={22} />
                <h2 className="text-xl font-bold">Appuntamenti Montaggi</h2>
                <span className="bg-white text-purple-700 text-xs font-bold rounded-full px-2 py-0.5 ml-1">
                  {montaggiSorted.length}
                </span>
              </div>
              <button onClick={() => setShowMontaggiModal(false)} className="text-white hover:bg-purple-800 rounded p-1">
                <X size={24} />
              </button>
            </div>
            <div className="p-4">
              {montaggiSorted.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Wrench size={48} className="mx-auto mb-3 opacity-30" />
                  <p>Nessun appuntamento montaggio pianificato</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {montaggiSorted.map(v => {
                    const isPast = (() => {
                      if (!v.dataRitiro || !v.oraMontaggio) return false;
                      const [h, m] = v.oraMontaggio.split(':').map(Number);
                      const appt = new Date(v.dataRitiro + 'T00:00:00');
                      appt.setHours(h, m, 0, 0);
                      return appt < new Date();
                    })();
                    return (
                      <div
                        key={v.id}
                        className={`border rounded-lg p-3 flex items-center gap-4 ${
                          v.ritiroSvolto ? 'bg-gray-50 border-gray-200 opacity-60' :
                          isPast ? 'bg-red-50 border-red-200' :
                          'bg-purple-50 border-purple-200'
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 truncate">{v.committente}</p>
                          <p className="text-xs text-gray-500 truncate">Telaio: {v.numeroTelaio || 'N/A'}</p>
                          {v.codiceAllestimentoSAP && (
                            <p className="text-xs text-gray-500 truncate">SAP: {v.codiceAllestimentoSAP}</p>
                          )}
                          {v.descrizioneAllestimento && (
                            <p className="text-xs text-blue-700 truncate">{v.descrizioneAllestimento}</p>
                          )}
                        </div>
                        <div className="text-center flex-shrink-0">
                          <p className="text-[10px] text-gray-400 uppercase">Data</p>
                          <p className="text-sm font-semibold text-gray-700">{fmtDMY(v.dataRitiro) || '-'}</p>
                        </div>
                        <div className="text-center flex-shrink-0">
                          <p className="text-[10px] text-gray-400 uppercase">Ora</p>
                          <p className="text-sm font-bold text-purple-700">{v.oraMontaggio}</p>
                        </div>
                        <div className="flex-shrink-0">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            v.status === 'ritirato' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                            v.status === 'pronto' ? 'bg-green-100 text-green-700 border border-green-200' :
                            v.status === 'in-allestimento' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                            'bg-red-100 text-red-700 border border-red-200'
                          }`}>
                            {v.status === 'ritirato' ? '🚚 Ritirato' :
                             v.status === 'pronto' ? '✅ Pronto' :
                             v.status === 'in-allestimento' ? '🔧 In All.' :
                             '🔴 Da All.'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};



export default PianificazioneRitiriPage;
