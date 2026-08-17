import { useState, useEffect } from 'react';
import { Car, MapPin, Search, Settings, X, Plus, Eye } from 'lucide-react';
import { collection, onSnapshot, setDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, logAction } from '../firebase';
import { useUser } from '../contexts/UserContext';
import { useNotification } from '../contexts/NotificationContext';
import { PARKING_P2_LAYOUT } from '../constants/parking';
import { fmtDMY, getVehicleStatusLabel } from '../utils/dateUtils';
import { useFilteredVehicles } from '../hooks/useFilteredVehicles';
import { isCollaudoPending } from '../utils/collaudoUtils';
import { searchVehicle as vehicleMatchesSearch } from '../utils/searchUtils';

const ParcheggioPage = ({ vehicles, userName, onEditVehicle }) => {
  const { isReadOnly } = useUser();
  const { showToast, showConfirm } = useNotification();
  const [parkingData, setParkingData] = useState({});
  const [selectedSpot, setSelectedSpot] = useState(null);
  const [showVehicleSelector, setShowVehicleSelector] = useState(false);
  const [searchVehicle, setSearchVehicle] = useState('');
  const [selectedVehicleForDetails, setSelectedVehicleForDetails] = useState(null);
  const [activeSide, setActiveSide] = useState('SX');

  // Equivalente a "status !== 'ritirato'" sui 4 status possibili
  const availableVehicles = useFilteredVehicles(vehicles, ['da-allestire', 'in-allestimento', 'pronto']);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'parkingSpots'), (snapshot) => {
      const data = {};
      snapshot.docs.forEach(doc => {
        data[doc.id] = doc.data();
      });
      setParkingData(data);
    }, (error) => { console.error('parkingSpots listener error:', error); showToast('Errore connessione database. Ricarica la pagina.', 'error'); });
    return unsubscribe;
  }, []);

  const getSpotId = (side, col, row) => `${side}-${col}${row}`;

  const occupiedCount = Object.keys(parkingData).length;
  const freeCount = PARKING_P2_LAYOUT.totalSpots - occupiedCount;

  // FIX: Funzione per ottenere i dati LIVE del veicolo
  const getLiveVehicleData = (spotData) => {
    if (!spotData || !spotData.vehicleId) return null;
    // Cerca il veicolo nell'array vehicles (dati live da Firebase)
    const liveVehicle = vehicles.find(v => v.id === spotData.vehicleId);
    // Se trovato, usa i dati live; altrimenti fallback ai dati salvati nel parcheggio
    return liveVehicle || spotData.vehicleData;
  };

  const handleSpotClick = (spotId) => {
    const spotData = parkingData[spotId];
    if (spotData && spotData.vehicleId) {
      // FIX: Usa sempre i dati live del veicolo
      const liveVehicle = getLiveVehicleData(spotData);
      setSelectedVehicleForDetails(liveVehicle);
    } else {
      if (isReadOnly) return;
      setSelectedSpot(spotId);
      setShowVehicleSelector(true);
      setSearchVehicle('');
    }
  };

  const handleAssignVehicle = async (vehicle) => {
    if (isReadOnly || !selectedSpot) return;
    try {
      const parts = selectedSpot.split('-');
      const side = parts[0];
      const colRow = parts[1];
      const col = colRow.replace(/[0-9]/g, '');
      const row = parseInt(colRow.replace(/[A-Z]/g, ''));

      await setDoc(doc(db, 'parkingSpots', selectedSpot), {
        id: selectedSpot,
        side: side,
        column: col,
        row: row,
        status: 'occupied',
        vehicleId: vehicle.id,
        vehicleData: {
          committente: vehicle.committente,
          targa: vehicle.targa,
          numeroTelaio: vehicle.numeroTelaio,
          tipoAllestimento: vehicle.tipoAllestimento,
          status: vehicle.status
        },
        assignedAt: new Date().toISOString(),
        assignedBy: userName
      });
      await logAction(userName, `Assegnazione P2 ${selectedSpot}`, {
        committente: vehicle.committente,
        numeroTelaio: vehicle.numeroTelaio
      });
      setShowVehicleSelector(false);
      setSelectedSpot(null);
    } catch (error) {
      console.error('Errore:', error);
      showToast('Errore durante l\'assegnazione del veicolo.', 'error');
    }
  };

  const handleRemoveVehicle = async (spotId, e) => {
    if (e) e.stopPropagation();
    if (isReadOnly) return;
    if (!await showConfirm('Rimuovere il veicolo da questo posto?')) return;
    try {
      const spotData = parkingData[spotId];
      await deleteDoc(doc(db, 'parkingSpots', spotId));
      await logAction(userName, `Rimozione da P2 ${spotId}`, spotData?.vehicleData || {});
    } catch (error) {
      console.error('Errore:', error);
    }
  };

  const handleEditFromParking = (vehicle) => {
    setSelectedVehicleForDetails(null);
    if (onEditVehicle) onEditVehicle(vehicle);
  };

  const filteredVehicles = availableVehicles.filter(v => vehicleMatchesSearch(v, searchVehicle));

  // Componente singolo posto parcheggio - FIX: Usa dati LIVE
  const ParkingSpot = ({ spotId }) => {
    const spotData = parkingData[spotId];
    const hasVehicle = spotData && spotData.vehicleId;
    
    // FIX: Ottieni dati live del veicolo per il colore corretto
    const liveVehicle = hasVehicle ? getLiveVehicleData(spotData) : null;
    
    const getStatusStyle = () => {
      if (!hasVehicle || !liveVehicle) return 'bg-emerald-100 border-emerald-400 hover:bg-emerald-200';
      
      // FIX: Usa lo status dal veicolo LIVE, non dai dati salvati
      const status = liveVehicle.status;
      
      if (status === 'da-allestire') return 'bg-red-500 border-red-700 text-white';
      if (status === 'in-allestimento') return 'bg-amber-400 border-amber-600 text-gray-900';
      if (status === 'pronto') return 'bg-blue-500 border-blue-700 text-white';
      if (status === 'ritirato') return 'bg-gray-400 border-gray-600 text-white';
      return 'bg-gray-400 border-gray-600 text-white';
    };

    const displayLabel = spotId.split('-')[1];

    return (
      <div
        onClick={() => handleSpotClick(spotId)}
        className={`
          relative border-2 ${getStatusStyle()}
          h-12 w-12 text-xs
          flex flex-col items-center justify-center cursor-pointer
          hover:shadow-lg transition-all rounded group
        `}
        title={hasVehicle && liveVehicle ? `${liveVehicle.committente} - ${liveVehicle.targa || 'N/A'} - ${liveVehicle.status}` : `Posto ${displayLabel} - Libero`}
      >
        <div className="font-bold leading-tight">{displayLabel}</div>
        {hasVehicle && liveVehicle && (
          <>
            <div className="text-[9px] truncate w-full text-center px-0.5 leading-tight">
              {liveVehicle.chiaviDoppioParcheggio || liveVehicle.committente?.substring(0, 6)}
            </div>
            {!isReadOnly && (
              <button
                onClick={(e) => handleRemoveVehicle(spotId, e)}
                className="absolute -top-1 -right-1 bg-red-600 text-white w-4 h-4 rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                title="Rimuovi"
              >
                ×
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  const renderRow = (side, rowNum, columns, columnBlocks) => {
    const elements = [];

    columnBlocks.forEach((block, blockIdx) => {
      const spotsInBlock = block.filter(col => columns.includes(col));
      
      if (spotsInBlock.length > 0) {
        if (blockIdx > 0) {
          elements.push(
            <div key={`gap-${rowNum}-${blockIdx}`} className="w-2" />
          );
        }
        
        spotsInBlock.forEach(col => {
          elements.push(
            <ParkingSpot 
              key={getSpotId(side, col, rowNum)} 
              spotId={getSpotId(side, col, rowNum)}
            />
          );
        });
      }
    });

    return elements;
  };

  const renderSide = (side) => {
    const sideConfig = PARKING_P2_LAYOUT.sides[side];
    const rows = Object.keys(sideConfig.rows).map(Number).sort((a, b) => a - b);
    const upperRows = rows.filter(r => r <= 6);
    const lowerRows = rows.filter(r => r >= 11);

    return (
      <div className="flex flex-col gap-2">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs font-semibold text-gray-500 mb-2 text-center">Righe 3-4</div>
          <div className="flex flex-col gap-1">
            {upperRows.map(rowNum => (
              <div key={`${side}-row-${rowNum}`} className="flex items-center gap-1">
                <span className="w-5 text-xs font-medium text-gray-400 text-right">{rowNum}</span>
                <div className="flex gap-0.5">
                  {renderRow(side, rowNum, sideConfig.rows[rowNum], sideConfig.columnBlocks)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="h-6 bg-gradient-to-r from-gray-300 via-gray-200 to-gray-300 rounded flex items-center justify-center">
          <span className="text-[10px] font-bold text-gray-500 tracking-widest">CORSIA</span>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs font-semibold text-gray-500 mb-2 text-center">Righe 11-12</div>
          <div className="flex flex-col gap-1">
            {lowerRows.map(rowNum => (
              <div key={`${side}-row-${rowNum}`} className="flex items-center gap-1">
                <span className="w-5 text-xs font-medium text-gray-400 text-right">{rowNum}</span>
                <div className="flex gap-0.5">
                  {renderRow(side, rowNum, sideConfig.rows[rowNum], sideConfig.columnBlocks)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <MapPin className="text-blue-600" />
            Parcheggio P2
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            {PARKING_P2_LAYOUT.totalSpots} posti • {freeCount} liberi • {occupiedCount} occupati
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-4">
        <h3 className="font-bold mb-3 text-sm">Legenda:</h3>
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-emerald-100 border-2 border-emerald-400 rounded"></div>
            <span>Libero</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-red-500 border-2 border-red-700 rounded"></div>
            <span>Da Allestire</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-amber-400 border-2 border-amber-600 rounded"></div>
            <span>In Allestimento</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-blue-500 border-2 border-blue-700 rounded"></div>
            <span>Pronto</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-400 border-2 border-gray-600 rounded"></div>
            <span>Ritirato</span>
          </div>
        </div>
      </div>

      {/* Toggle per mobile */}
      <div className="md:hidden flex gap-2">
        <button
          onClick={() => setActiveSide('SX')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${activeSide === 'SX' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          Lato SX ({PARKING_P2_LAYOUT.sides.SX.totalSpots})
        </button>
        <button
          onClick={() => setActiveSide('DX')}
          className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${activeSide === 'DX' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          Lato DX ({PARKING_P2_LAYOUT.sides.DX.totalSpots})
        </button>
      </div>

      {/* Layout Parcheggio */}
      <div className="bg-white rounded-xl shadow-lg p-4 overflow-x-auto">
        {/* Desktop */}
        <div className="hidden md:flex gap-3 min-w-max">
          <div className="flex-1">
            <div className="bg-blue-600 text-white text-center py-2 rounded-t-lg font-bold text-sm">
              LATO SX ({PARKING_P2_LAYOUT.sides.SX.totalSpots} posti)
            </div>
            <div className="border-2 border-t-0 border-blue-600 rounded-b-lg p-2">
              {renderSide('SX')}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center px-2">
            <div className="bg-gradient-to-b from-blue-600 via-blue-500 to-blue-600 text-white font-bold text-xl py-6 px-3 rounded-lg shadow-lg" style={{writingMode: 'vertical-rl'}}>
              P2
            </div>
          </div>

          <div className="flex-1">
            <div className="bg-green-600 text-white text-center py-2 rounded-t-lg font-bold text-sm">
              LATO DX ({PARKING_P2_LAYOUT.sides.DX.totalSpots} posti)
            </div>
            <div className="border-2 border-t-0 border-green-600 rounded-b-lg p-2">
              {renderSide('DX')}
            </div>
          </div>
        </div>

        {/* Mobile */}
        <div className="md:hidden">
          {activeSide === 'SX' && (
            <div>
              <div className="bg-blue-600 text-white text-center py-2 rounded-t-lg font-bold">
                LATO SX ({PARKING_P2_LAYOUT.sides.SX.totalSpots} posti)
              </div>
              <div className="border-2 border-t-0 border-blue-600 rounded-b-lg p-2 overflow-x-auto">
                {renderSide('SX')}
              </div>
            </div>
          )}
          {activeSide === 'DX' && (
            <div>
              <div className="bg-green-600 text-white text-center py-2 rounded-t-lg font-bold">
                LATO DX ({PARKING_P2_LAYOUT.sides.DX.totalSpots} posti)
              </div>
              <div className="border-2 border-t-0 border-green-600 rounded-b-lg p-2 overflow-x-auto">
                {renderSide('DX')}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal selezione veicolo */}
      {showVehicleSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 flex justify-between items-center">
              <h3 className="text-xl font-bold">Assegna Veicolo a {selectedSpot}</h3>
              <button onClick={() => setShowVehicleSelector(false)} className="text-white hover:text-gray-200">
                <X size={24} />
              </button>
            </div>

            <div className="p-4 border-b">
              <div className="flex items-center gap-2">
                <Search size={20} className="text-gray-400" />
                <input
                  type="text"
                  placeholder="Cerca veicolo..."
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                  value={searchVehicle}
                  onChange={(e) => setSearchVehicle(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {filteredVehicles.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Car size={48} className="mx-auto mb-3 opacity-30" />
                  <p>Nessun veicolo disponibile</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredVehicles.map(vehicle => {
                    const statusConfig = {
                      'da-allestire': { color: 'bg-red-50 border-red-300 hover:bg-red-100', icon: '🔴' },
                      'in-allestimento': { color: 'bg-amber-50 border-amber-300 hover:bg-amber-100', icon: '🔧' },
                      'pronto': { color: 'bg-blue-50 border-blue-300 hover:bg-blue-100', icon: '✅' }
                    };
                    const config = statusConfig[vehicle.status] || statusConfig['da-allestire'];

                    return (
                      <div
                        key={vehicle.id}
                        onClick={() => handleAssignVehicle(vehicle)}
                        className={`${config.color} border-2 rounded-xl p-4 cursor-pointer transition-all hover:shadow-lg`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xl">{config.icon}</span>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-bold truncate">{vehicle.committente}</h4>
                            <p className="text-xs text-gray-600 truncate">
                              {vehicle.targa && `${vehicle.targa} • `}{vehicle.numeroTelaio || 'N/A'}
                            </p>
                          </div>
                        </div>
                        <div className="text-xs text-gray-600">
                          <p><span className="font-medium">Tipo:</span> {vehicle.tipoAllestimento}</p>
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

      {/* Modal dettagli veicolo */}
      {selectedVehicleForDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-4 flex justify-between items-center rounded-t-xl sticky top-0">
              <h3 className="text-xl font-bold">Dettagli Veicolo</h3>
              <button onClick={() => setSelectedVehicleForDetails(null)} className="text-white hover:text-gray-200">
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="col-span-2 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-200">
                  <h4 className="font-bold text-xl text-gray-800">{selectedVehicleForDetails.committente}</h4>
                  <div className="flex gap-2 mt-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      selectedVehicleForDetails.status === 'da-allestire' ? 'bg-red-200 text-red-800' :
                      selectedVehicleForDetails.status === 'in-allestimento' ? 'bg-amber-200 text-amber-800' :
                      selectedVehicleForDetails.status === 'pronto' && isCollaudoPending(selectedVehicleForDetails) ? 'bg-orange-200 text-orange-800' :
                      selectedVehicleForDetails.status === 'pronto' ? 'bg-blue-200 text-blue-800' :
                      'bg-gray-200 text-gray-800'
                    }`}>
                      {getVehicleStatusLabel(selectedVehicleForDetails)}
                    </span>
                  </div>
                </div>

                {selectedVehicleForDetails.targa && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs font-medium text-gray-500">Targa</p>
                    <p className="font-bold text-lg">{selectedVehicleForDetails.targa}</p>
                  </div>
                )}
                
                {selectedVehicleForDetails.numeroTelaio && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs font-medium text-gray-500">Numero Telaio</p>
                    <p className="font-semibold">{selectedVehicleForDetails.numeroTelaio}</p>
                  </div>
                )}
                
                {selectedVehicleForDetails.tipoAllestimento && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs font-medium text-gray-500">Tipo Allestimento</p>
                    <p className="font-semibold capitalize">{selectedVehicleForDetails.tipoAllestimento}</p>
                  </div>
                )}

                {selectedVehicleForDetails.dataConsegna && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-xs font-medium text-gray-500">Data Consegna</p>
                    <p className="font-semibold">{fmtDMY(selectedVehicleForDetails.dataConsegna)}</p>
                  </div>
                )}

                {selectedVehicleForDetails.chiaviDoppioParcheggio && (
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                    <p className="text-xs font-medium text-amber-700">Chiavi parcheggio</p>
                    <p className="font-semibold text-amber-900">{selectedVehicleForDetails.chiaviDoppioParcheggio}</p>
                  </div>
                )}
              </div>

              {selectedVehicleForDetails.note && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-xs font-medium text-gray-600 mb-1">Note</p>
                  <p className="text-sm">{selectedVehicleForDetails.note}</p>
                </div>
              )}
              
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setSelectedVehicleForDetails(null)}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-3 rounded-xl hover:bg-gray-300 transition-colors font-medium"
                >
                  Chiudi
                </button>
                {onEditVehicle && (
                  <button
                    onClick={() => handleEditFromParking(selectedVehicleForDetails)}
                    className="flex-1 bg-blue-600 text-white px-4 py-3 rounded-xl hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <Settings size={18} />
                    Modifica
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};





export default ParcheggioPage;
