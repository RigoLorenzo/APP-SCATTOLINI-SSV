import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Download, FolderOpen, RefreshCw, Shield, CheckCircle, AlertCircle, Clock, HardDrive, Info, X } from 'lucide-react';
import {
  fetchAllData,
  getBackupTimestamp,
  getRecordCounts,
  isFileSystemAccessSupported,
  saveDirectoryHandle,
  loadDirectoryHandle,
  verifyPermission,
  writeXLSXBackupToDirectory,
  downloadXLSXBackup,
  saveAutoBackupSettings,
  loadAutoBackupSettings,
  saveLastBackupTime,
  getLastBackupTime,
  isBackupDue,
  COLLECTION_LABELS,
} from '../utils/backupUtils';

export default function BackupExport({ db, userName, isAdmin }) {
  const [dirHandle, setDirHandle] = useState(null);
  const [dirName, setDirName] = useState('');
  const [backupStatus, setBackupStatus] = useState('idle'); // idle | running | success | error
  const [statusMessage, setStatusMessage] = useState('');
  const [lastBackup, setLastBackup] = useState(getLastBackupTime());
  const [autoSettings, setAutoSettings] = useState(loadAutoBackupSettings());
  const [selectedCollections, setSelectedCollections] = useState(
    Object.keys(COLLECTION_LABELS)
  );
  const [backupStats, setBackupStats] = useState(null);
  const [fileCreated, setFileCreated] = useState('');
  const autoBackupTimerRef = useRef(null);
  const fsSupported = isFileSystemAccessSupported();

  // Carica l'handle della cartella salvato
  useEffect(() => {
    if (!fsSupported) return;
    (async () => {
      try {
        const handle = await loadDirectoryHandle();
        if (handle) {
          const hasPermission = await verifyPermission(handle);
          if (hasPermission) {
            setDirHandle(handle);
            setDirName(handle.name);
          }
        }
      } catch {
        // Handle non disponibile, l'utente dovra' ri-selezionare
      }
    })();
  }, [fsSupported]);

  // Auto-backup timer
  useEffect(() => {
    if (!autoSettings.enabled || !dirHandle) {
      if (autoBackupTimerRef.current) {
        clearInterval(autoBackupTimerRef.current);
        autoBackupTimerRef.current = null;
      }
      return;
    }

    // Controlla subito se il backup e' dovuto
    if (isBackupDue(autoSettings.intervalHours)) {
      runBackup(true);
    }

    // Imposta il controllo periodico (ogni 15 minuti)
    autoBackupTimerRef.current = setInterval(() => {
      if (isBackupDue(autoSettings.intervalHours)) {
        runBackup(true);
      }
    }, 15 * 60 * 1000);

    return () => {
      if (autoBackupTimerRef.current) {
        clearInterval(autoBackupTimerRef.current);
      }
    };
  }, [autoSettings.enabled, autoSettings.intervalHours, dirHandle]);

  const handleSelectDirectory = async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
      setDirHandle(handle);
      setDirName(handle.name);
      await saveDirectoryHandle(handle);
      setStatusMessage(`Cartella "${handle.name}" selezionata`);
    } catch (err) {
      if (err.name !== 'AbortError') {
        setStatusMessage('Errore nella selezione della cartella');
      }
    }
  };

  const runBackup = useCallback(async (isAuto = false) => {
    if (backupStatus === 'running') return;
    setBackupStatus('running');
    setStatusMessage(isAuto ? 'Backup automatico in corso...' : 'Backup in corso...');
    setBackupStats(null);
    setFileCreated('');

    try {
      const data = await fetchAllData(db, selectedCollections);
      const timestamp = getBackupTimestamp();
      const counts = getRecordCounts(data);
      let filename = null;

      if (dirHandle && fsSupported) {
        const hasPermission = await verifyPermission(dirHandle);
        if (hasPermission) {
          filename = await writeXLSXBackupToDirectory(dirHandle, data, timestamp, isAdmin);
          setBackupStatus('success');
          setStatusMessage(`File XLSX salvato in "${dirName}"`);
        } else {
          filename = await downloadXLSXBackup(data, timestamp, isAdmin);
          setDirHandle(null);
          setDirName('');
          setBackupStatus('success');
          setStatusMessage('Permesso cartella perso. File XLSX scaricato');
        }
      } else {
        filename = await downloadXLSXBackup(data, timestamp, isAdmin);
        setBackupStatus('success');
        setStatusMessage('File XLSX scaricato');
      }

      saveLastBackupTime();
      setLastBackup(new Date().toISOString());
      setBackupStats(counts);
      setFileCreated(filename || '');
    } catch (error) {
      console.error('Errore backup:', error);
      setBackupStatus('error');
      setStatusMessage(`Errore: ${error.message}`);
    }
  }, [db, userName, isAdmin, dirHandle, dirName, fsSupported, selectedCollections, backupStatus]);

  const toggleCollection = (name) => {
    setSelectedCollections(prev =>
      prev.includes(name)
        ? prev.filter(c => c !== name)
        : [...prev, name]
    );
  };

  const toggleAutoBackup = (enabled) => {
    const newSettings = { ...autoSettings, enabled };
    setAutoSettings(newSettings);
    saveAutoBackupSettings(newSettings);
  };

  const setInterval_ = (hours) => {
    const newSettings = { ...autoSettings, intervalHours: hours };
    setAutoSettings(newSettings);
    saveAutoBackupSettings(newSettings);
  };

  const formatDateTime = (iso) => {
    if (!iso) return 'Mai';
    const d = new Date(iso);
    return d.toLocaleDateString('it-IT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Intestazione */}
      <div className="flex items-center gap-3">
        <div className="bg-blue-100 p-3 rounded-xl">
          <Shield size={28} className="text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Backup Locale</h2>
          <p className="text-gray-500 text-sm">Esporta i dati in formato XLSX nella cartella aziendale</p>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3">
        <Info size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">Come funziona il backup locale</p>
          <p>
            {fsSupported
              ? 'Seleziona una cartella locale (es. cartella condivisa aziendale o NAS) e il sistema salverà un unico file XLSX di backup con un foglio per ogni tipo di dato (veicoli, kit, ecc.).'
              : 'Il tuo browser non supporta la scrittura diretta su cartella locale. Il backup verrà scaricato come file XLSX nella cartella Download. Per la scrittura diretta, usa Google Chrome o Microsoft Edge.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Colonna sinistra: Configurazione */}
        <div className="space-y-6">
          {/* Selezione cartella */}
          {fsSupported && (
            <div className="bg-white rounded-xl border shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <FolderOpen size={18} className="text-amber-500" />
                Cartella di Destinazione
              </h3>
              {dirHandle ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle size={16} className="text-green-500" />
                      <span className="text-green-800 font-medium text-sm">{dirName}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleSelectDirectory}
                    className="text-sm text-blue-600 hover:text-blue-800 underline whitespace-nowrap"
                  >
                    Cambia
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleSelectDirectory}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg px-4 py-6 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors group"
                >
                  <FolderOpen size={32} className="mx-auto mb-2 text-gray-400 group-hover:text-blue-500" />
                  <span className="text-gray-600 group-hover:text-blue-600 font-medium">
                    Seleziona cartella di backup
                  </span>
                  <p className="text-xs text-gray-400 mt-1">Es. cartella condivisa aziendale, NAS, disco esterno</p>
                </button>
              )}
            </div>
          )}

          {/* Selezione collezioni */}
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <HardDrive size={18} className="text-purple-500" />
              Dati da Includere
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(COLLECTION_LABELS).map(([key, label]) => (
                <label
                  key={key}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                    selectedCollections.includes(key)
                      ? 'bg-blue-50 border-blue-300 text-blue-800'
                      : 'bg-gray-50 border-gray-200 text-gray-500'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedCollections.includes(key)}
                    onChange={() => toggleCollection(key)}
                    className="rounded text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium">{label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Auto-backup */}
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <RefreshCw size={18} className="text-green-500" />
              Backup Automatico
            </h3>
            {!fsSupported && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3">
                Il backup automatico richiede Chrome/Edge per la scrittura diretta su cartella.
              </p>
            )}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-700">Abilita backup automatico</span>
              <button
                onClick={() => toggleAutoBackup(!autoSettings.enabled)}
                disabled={!fsSupported || !dirHandle}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  autoSettings.enabled && dirHandle ? 'bg-green-500' : 'bg-gray-300'
                } ${(!fsSupported || !dirHandle) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    autoSettings.enabled && dirHandle ? 'translate-x-6' : ''
                  }`}
                />
              </button>
            </div>
            {autoSettings.enabled && dirHandle && (
              <div>
                <label className="text-sm text-gray-600 block mb-2">Frequenza backup</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { hours: 6, label: 'Ogni 6 ore' },
                    { hours: 12, label: 'Ogni 12 ore' },
                    { hours: 24, label: 'Giornaliero' },
                  ].map(opt => (
                    <button
                      key={opt.hours}
                      onClick={() => setInterval_(opt.hours)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        autoSettings.intervalHours === opt.hours
                          ? 'bg-green-100 text-green-700 border border-green-300'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-transparent'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!dirHandle && fsSupported && (
              <p className="text-xs text-gray-400 mt-2">Seleziona prima una cartella di destinazione</p>
            )}
          </div>
        </div>

        {/* Colonna destra: Stato e azione */}
        <div className="space-y-6">
          {/* Pulsante backup manuale */}
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <button
              onClick={() => runBackup(false)}
              disabled={backupStatus === 'running' || selectedCollections.length === 0}
              className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-semibold text-lg transition-all ${
                backupStatus === 'running'
                  ? 'bg-blue-400 text-white cursor-wait'
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl active:scale-[0.98]'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {backupStatus === 'running' ? (
                <>
                  <RefreshCw size={24} className="animate-spin" />
                  Backup in corso...
                </>
              ) : (
                <>
                  <Download size={24} />
                  {dirHandle ? 'Esegui Backup XLSX su Cartella' : 'Scarica Backup XLSX'}
                </>
              )}
            </button>
            {selectedCollections.length === 0 && (
              <p className="text-xs text-red-500 mt-2 text-center">
                Seleziona almeno una collezione di dati
              </p>
            )}
          </div>

          {/* Stato ultimo backup */}
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <Clock size={18} className="text-gray-500" />
              Stato Backup
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Ultimo backup:</span>
                <span className="text-sm font-medium text-gray-800">
                  {formatDateTime(lastBackup)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Formato:</span>
                <span className="text-sm font-medium text-gray-800">XLSX (Excel)</span>
              </div>
              {dirHandle && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Cartella:</span>
                  <span className="text-sm font-medium text-gray-800">{dirName}</span>
                </div>
              )}
              {autoSettings.enabled && dirHandle && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Prossimo backup:</span>
                  <span className="text-sm font-medium text-green-600">
                    {lastBackup
                      ? formatDateTime(
                          new Date(
                            new Date(lastBackup).getTime() +
                            autoSettings.intervalHours * 60 * 60 * 1000
                          ).toISOString()
                        )
                      : 'A breve'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Risultato ultimo backup */}
          {statusMessage && (
            <div
              className={`rounded-xl border p-4 flex items-start gap-3 ${
                backupStatus === 'success'
                  ? 'bg-green-50 border-green-200'
                  : backupStatus === 'error'
                  ? 'bg-red-50 border-red-200'
                  : backupStatus === 'running'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              {backupStatus === 'success' && <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" />}
              {backupStatus === 'error' && <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />}
              {backupStatus === 'running' && <RefreshCw size={20} className="text-blue-500 flex-shrink-0 mt-0.5 animate-spin" />}
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  backupStatus === 'success' ? 'text-green-800' :
                  backupStatus === 'error' ? 'text-red-800' :
                  'text-blue-800'
                }`}>
                  {statusMessage}
                </p>
                {backupStats && backupStatus === 'success' && (
                  <div className="mt-2 space-y-1">
                    {Object.entries(backupStats).map(([key, count]) => (
                      count > 0 && (
                        <div key={key} className="text-xs text-green-700">
                          {COLLECTION_LABELS[key] || key}: <strong>{count}</strong> record
                        </div>
                      )
                    ))}
                  </div>
                )}
                {fileCreated && backupStatus === 'success' && (
                  <div className="mt-3 pt-2 border-t border-green-200">
                    <p className="text-xs font-medium text-green-700 mb-1">File creato:</p>
                    <div className="text-xs text-green-600 font-mono">{fileCreated}</div>
                  </div>
                )}
              </div>
              {backupStatus !== 'running' && (
                <button
                  onClick={() => { setStatusMessage(''); setBackupStats(null); setBackupStatus('idle'); setFileCreated(''); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )}

          {/* Guida rapida */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-700 mb-3">Guida Rapida</h3>
            <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
              {fsSupported ? (
                <>
                  <li>Seleziona la <strong>cartella aziendale</strong> di destinazione (NAS, disco condiviso...)</li>
                  <li>Scegli i <strong>dati da includere</strong> nel backup</li>
                  <li>Clicca <strong>"Esegui Backup XLSX"</strong> per salvare il file</li>
                  <li>Attiva il <strong>backup automatico</strong> per non doverti ricordare</li>
                </>
              ) : (
                <>
                  <li>Scegli i <strong>dati da includere</strong> nel backup</li>
                  <li>Clicca <strong>"Scarica Backup XLSX"</strong> per scaricare il file</li>
                  <li>Sposta il file nella <strong>cartella aziendale condivisa</strong></li>
                  <li>Per la scrittura diretta su cartella, usa <strong>Chrome o Edge</strong></li>
                </>
              )}
            </ol>
            <div className="mt-3 pt-3 border-t border-gray-200">
              <p className="text-xs text-gray-500">
                Il file XLSX è apribile con <strong>Excel</strong>, Google Sheets o qualsiasi programma di fogli di calcolo.
                Ogni collezione viene esportata in un foglio separato all'interno dello stesso file (es. <code className="bg-gray-200 px-1 rounded">backup_2026-02-17_14-30-00.xlsx</code>).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
