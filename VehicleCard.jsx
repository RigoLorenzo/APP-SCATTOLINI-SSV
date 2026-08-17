import { AlertCircle, CheckCircle, Copy, Eye, FileText, Settings, Trash2, Truck, XCircle } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { fmtDMY } from '../utils/dateUtils';
import { getVehicleStatusConfig } from '../constants/vehicleStatus';
import { formatCollaudoShort } from '../utils/collaudoUtils';

/**
 * Card veicolo unificata, con 3 varianti che corrispondevano a
 * implementazioni duplicate (vedi ARCHITETTURA_SSV_MANAGER.md §9/§10):
 * - "detail": ex VehicleDetailCard.jsx (usata da DayDetailModal)
 * - "row": ex blocco inline in RiepilogoPage
 * - "compact": ex CompactVehicleCard interna a OfficinaPage
 */
const VehicleCard = ({
  variant = 'detail',
  vehicle,
  isHighlighted = false,
  onEdit,
  onDelete,
  onCopy,
  // compact (Officina): stato/gestione passati dalla pagina, che resta
  // proprietaria delle scritture Firestore e dei loading state per id.
  showStartButton = false,
  isUrgentLoading = false,
  isStatusLoading = false,
  isLate = false,
  onToggleUrgent,
  onStatusChange,
}) => {
  const { isReadOnly } = useUser();

  if (variant === 'row') {
    return (
      <div
        className={`bg-white bg-opacity-70 rounded p-2 text-sm hover:bg-opacity-90 transition-all ${isHighlighted ? 'ring-2 ring-blue-500 bg-opacity-100' : ''}`}
      >
        <div className="flex justify-between items-start">
          <div className="flex-1 cursor-pointer" onClick={() => onEdit(vehicle)}>
            <p className="font-medium">{vehicle.committente}</p>
            {vehicle.tipoAllestimento && <p className="text-xs text-gray-600 capitalize">Tipo: {vehicle.tipoAllestimento}</p>}
            <p className="text-xs text-gray-600">Telaio: {vehicle.numeroTelaio || 'N/A'}</p>
            <p className="text-xs text-gray-600">Consegna: {fmtDMY(vehicle.dataConsegna)}</p>
            {vehicle.targa && <p className="text-xs text-gray-600">Targa: {vehicle.targa}</p>}
            {vehicle.chiaviDoppioParcheggio && <p className="text-xs text-gray-600">Chiavi parcheggio: {vehicle.chiaviDoppioParcheggio}</p>}
          </div>
          <div className="flex gap-1 mt-1">
            <Settings size={14} className="text-blue-600 cursor-pointer" onClick={() => onEdit(vehicle)} />
            {!isReadOnly && (
              <Trash2
                size={14}
                className="text-red-500 cursor-pointer"
                title="Elimina veicolo"
                onClick={(e) => { e.stopPropagation(); onDelete(vehicle.id); }}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 border-l-4 transition-all hover:shadow-md hover:border-gray-300 ${
        vehicle.urgente ? 'border-l-red-500 bg-red-50' :
        isLate ? 'border-l-orange-400 bg-orange-50' :
        'border-l-slate-400'
      }`}>
        <div className="px-3 py-2.5">
          {/* Riga principale */}
          <div className="flex items-center gap-3">
            {/* Badge Urgente */}
            {!isReadOnly ? (
              <button
                onClick={() => onToggleUrgent(vehicle)}
                disabled={isUrgentLoading}
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  vehicle.urgente
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-gray-200 text-gray-400 hover:bg-red-100 hover:text-red-500'
                }`}
                title={vehicle.urgente ? 'Rimuovi urgenza' : 'Imposta urgente'}
              >
                {isUrgentLoading ? (
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <AlertCircle size={16} />
                )}
              </button>
            ) : (
              vehicle.urgente && (
                <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-red-500 text-white animate-pulse">
                  <AlertCircle size={16} />
                </div>
              )
            )}

            {/* Info principali */}
            <div className="flex-1 min-w-0 grid grid-cols-2 md:grid-cols-9 gap-2 text-xs">
              <div className="col-span-2 md:col-span-1">
                <p className="text-gray-400 text-[10px] uppercase tracking-wide">Committente</p>
                <p className="font-bold text-gray-900 truncate text-sm">{vehicle.committente}</p>
              </div>
              <div>
                <p className="text-gray-400 text-[10px] uppercase">N° Telaio</p>
                <p className="font-semibold text-gray-700 truncate">{vehicle.numeroTelaio || '-'}</p>
              </div>
              <div className="hidden md:block">
                <p className="text-gray-400 text-[10px] uppercase">Tipo Allestimento</p>
                <div className="flex items-center gap-1">
                  <p className="font-semibold text-gray-700 truncate capitalize">{vehicle.tipoAllestimento || '-'}</p>
                  {vehicle.tipoAllestimento === 'box' && vehicle.conSpondaCaricatrice && (
                    <span className="text-[9px] bg-amber-100 text-amber-700 border border-amber-300 px-1 py-0.5 rounded font-bold whitespace-nowrap">+Sponda</span>
                  )}
                </div>
              </div>
              <div className="hidden md:block">
                <p className="text-gray-400 text-[10px] uppercase">Codice Allestimento</p>
                <p className="font-semibold text-gray-700 truncate">{vehicle.codiceAllestimentoSAP || '-'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-[10px] uppercase">N° Matricola</p>
                <p className="font-semibold text-gray-700 truncate">{vehicle.numeroMatricola || '-'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-[10px] uppercase">N° Ordine</p>
                <p className="font-semibold text-gray-700 truncate">{vehicle.ordineSAP || '-'}</p>
              </div>
              <div className="hidden md:block">
                <p className="text-gray-400 text-[10px] uppercase">Data Consegna</p>
                <p className="font-semibold text-gray-700 truncate">{fmtDMY(vehicle.dataConsegna) || '-'}</p>
              </div>
              <div className="hidden md:block">
                <p className="text-gray-400 text-[10px] uppercase">N° Matr. Liderkit</p>
                <p className={`font-semibold truncate ${vehicle.matricolaLiderkitRicevuta ? 'text-orange-700' : 'text-gray-700'}`}>{vehicle.numeroMatricolaLiderkit || '-'}</p>
              </div>
              <div className="hidden md:block">
                <p className="text-gray-400 text-[10px] uppercase">Chiavi Parcheggio</p>
                <p className="font-semibold text-gray-700 truncate">{vehicle.chiaviDoppioParcheggio || '-'}</p>
              </div>
            </div>

            {/* Azioni */}
            <div className="flex-shrink-0 flex items-center gap-1">
              {vehicle.distinta?.downloadURL && (
                <a
                  href={vehicle.distinta.downloadURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Visualizza distinta"
                  onClick={(e) => e.stopPropagation()}
                >
                  <FileText size={18} />
                </a>
              )}
              <button
                onClick={() => onEdit(vehicle)}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                title="Apri scheda veicolo"
              >
                <Eye size={18} />
              </button>

              {!isReadOnly && (showStartButton ? (
                <button
                  onClick={() => onStatusChange(vehicle, 'in-allestimento')}
                  disabled={isStatusLoading}
                  className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                >
                  {isStatusLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Truck size={14} />
                      <span className="hidden sm:inline">Inizia</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={() => onStatusChange(vehicle, 'pronto')}
                  disabled={isStatusLoading}
                  className="px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                >
                  {isStatusLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle size={14} />
                      <span className="hidden sm:inline">Completa</span>
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Descrizione allestimento — sempre visibile quando presente */}
          {vehicle.descrizioneAllestimento && (
            <div className="mt-2 flex items-start gap-2 bg-blue-50 border border-blue-100 rounded px-2 py-1.5">
              <FileText size={13} className="text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800 font-medium leading-snug">{vehicle.descrizioneAllestimento}</p>
            </div>
          )}

          {/* Riga secondaria su mobile */}
          <div className="md:hidden mt-2 pt-2 border-t border-gray-200 flex items-center justify-between text-xs">
            <div className="flex gap-3 flex-wrap">
              <span className="text-gray-500 capitalize">
                <span className="text-gray-400">Tipo:</span> {vehicle.tipoAllestimento || '-'}
              </span>
              <span className="text-gray-500">
                <span className="text-gray-400">Consegna:</span> {fmtDMY(vehicle.dataConsegna) || '-'}
              </span>
              <span className="text-gray-500">
                <span className="text-gray-400">N° Matr. Liderkit:</span> <span className={vehicle.matricolaLiderkitRicevuta ? 'text-orange-700 font-semibold' : ''}>{vehicle.numeroMatricolaLiderkit || '-'}</span>
              </span>
            </div>
          </div>

          {/* Info aggiuntive visibili su desktop */}
          <div className="hidden md:flex mt-2 pt-2 border-t border-gray-200 items-center gap-3 text-xs text-gray-500 flex-wrap">
            {isLate && (
              <span className="bg-orange-500 text-white px-2 py-0.5 rounded font-bold animate-pulse">
                ⚠ IN RITARDO
              </span>
            )}
            {vehicle.note && (
              <span className="text-amber-600 truncate max-w-xs">📝 {vehicle.note}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // variant === 'detail' (default)
  const config = getVehicleStatusConfig(vehicle.status);
  return (
    <div className={`${config.color} border-2 rounded-lg p-4 hover:shadow-lg transition-all ${isHighlighted ? 'ring-4 ring-green-500 ring-opacity-70 scale-105 shadow-xl' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{config.icon}</span>
          <div>
            <h3 className="font-bold text-lg">{vehicle.committente}</h3>
            <p className="text-xs opacity-75">{vehicle.numeroTelaio || 'N/A'}</p>
          </div>
        </div>
        {!isReadOnly && (
          <div className="flex gap-1">
            <button onClick={() => onCopy(vehicle)} className="p-2 hover:bg-white rounded" title="Copia">
              <Copy size={16} />
            </button>
            <button onClick={() => onDelete(vehicle.id)} className="p-2 hover:bg-white rounded text-red-600" title="Elimina">
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-2 text-sm mb-3">
        <div className="flex justify-between">
          <span className="font-medium">Tipo:</span>
          <span>{vehicle.tipoAllestimento}</span>
        </div>
        {vehicle.targa && (
          <div className="flex justify-between">
            <span className="font-medium">Targa:</span>
            <span>{vehicle.targa}</span>
          </div>
        )}
        {vehicle.ordineSAP && (
          <div className="flex justify-between">
            <span className="font-medium">SAP:</span>
            <span>{vehicle.ordineSAP}</span>
          </div>
        )}
        {vehicle.numeroMatricola && (
          <div className="flex justify-between">
            <span className="font-medium">Matricola:</span>
            <span>{vehicle.numeroMatricola}</span>
          </div>
        )}
        <div className="flex justify-between items-center">
          <span className="font-medium">Collaudo:</span>
          <span className="text-xs">{formatCollaudoShort(vehicle)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-medium">Pagamento:</span>
          {vehicle.pagamentoDocumenti ? <CheckCircle size={16} className="text-green-600" /> : <XCircle size={16} className="text-red-600" />}
        </div>
      </div>

      {vehicle.note && (
        <div className="bg-white bg-opacity-60 rounded p-2 mb-3 text-xs">
          <FileText size={12} className="inline mr-1" />
          {vehicle.note.substring(0, 80)}{vehicle.note.length > 80 ? '...' : ''}
        </div>
      )}

      <button onClick={() => onEdit(vehicle)} className="w-full bg-white bg-opacity-80 hover:bg-opacity-100 py-2 rounded font-medium text-sm transition-all">
        Modifica Completo
      </button>
    </div>
  );
};

export default VehicleCard;
