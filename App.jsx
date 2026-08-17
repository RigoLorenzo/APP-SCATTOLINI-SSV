import React, { useState, useEffect } from 'react';
import { Calendar, Truck, User, ChevronDown, Upload, Trash2, Menu, Package, ClipboardList, MessageCircle, BarChart3, Settings, MapPin, Car, LogOut, HardDrive, CheckSquare, Download, Mail, Hash } from 'lucide-react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import scattoliniLogo from './logo_scattolinivert-Xc8Z6.jpg';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { UserProvider, useUser } from './contexts/UserContext';
import { useVehicles } from './hooks/useVehicles';
import { useVehicleCrud } from './hooks/useVehicleCrud';
import LoginPage from './components/LoginPage';
import Toast from './components/Common/Toast';
import UniversalSearch from './components/Common/UniversalSearch';
import ExpiringVehiclesAlert from './components/Common/ExpiringVehiclesAlert';
import BackupExport from './components/BackupExport';
import { exportCompleteXLSX } from './utils/csvUtils';
import ErrorBoundary from './components/Common/ErrorBoundary';
import { db } from './firebase';
import Dropdown from './components/Common/Dropdown';
import ConfirmModal from './components/modals/ConfirmModal';
import DeleteAllModal from './components/modals/DeleteAllModal';
import ImportCSVModal from './components/modals/ImportCSVModal';
import CopyDateModal from './components/modals/CopyDateModal';
import VehicleModal from './components/modals/VehicleModal';
import EmailNotificationsModal from './components/modals/EmailNotificationsModal';

const FileMonitaggiPage = React.lazy(() => import('./pages/FileMonitaggiPage'));
const ParcheggioPage = React.lazy(() => import('./pages/ParcheggioPage'));
const RiepilogoPage = React.lazy(() => import('./pages/RiepilogoPage'));
const PianificazioneRitiriPage = React.lazy(() => import('./pages/PianificazioneRitiriPage'));
const ChatAzioniPage = React.lazy(() => import('./pages/ChatAzioniPage'));
const AnalisiStatistichePage = React.lazy(() => import('./pages/AnalisiStatistichePage'));
const KitsPage = React.lazy(() => import('./pages/KitsPage'));
const TelaiPage = React.lazy(() => import('./pages/TelaiPage'));
const OfficinaPage = React.lazy(() => import('./pages/OfficinaPage'));
const CollaudiPage = React.lazy(() => import('./pages/CollaudiPage'));

function AppContent() {
  const { currentUser, logout } = useAuth();
  const { userName, isAdmin, isReadOnly, isOmologatore } = useUser();
  const {
    toast, clearToast,
    notification, clearNotification,
    unreadMessagesCount, resetUnreadMessages,
    showNotification,
    confirmDialog, setConfirmDialog,
  } = useNotification();
  const { vehicles, loadingVehicles } = useVehicles();
  const {
    showVehicleModal, setShowVehicleModal,
    editingVehicle, setEditingVehicle,
    showCopyModal, setShowCopyModal,
    vehicleToCopy,
    showDeleteAllModal, setShowDeleteAllModal,
    showImportModal, setShowImportModal,
    handleAddVehicle,
    handleEditVehicle,
    handleSaveVehicle,
    handleDeleteVehicle,
    handleCopyVehicle,
    handleConfirmCopy,
    handleDeleteAll,
  } = useVehicleCrud(vehicles);

  const [currentPage, setCurrentPage] = useState('officina');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showEmailNotificationsModal, setShowEmailNotificationsModal] = useState(false);

  useEffect(() => {
    if (isOmologatore) setCurrentPage('riepilogo');
  }, [isOmologatore]);

  const handlePageChange = (pageId) => {
    setCurrentPage(pageId);
    if (pageId === 'chat') {
      resetUnreadMessages();
    }
  };

  const allPages = [
    { id: 'officina', label: 'Officina', icon: Truck },
    { id: 'file-montaggi', label: 'File Montaggi', icon: Calendar },
    { id: 'pianificazione-ritiri', label: 'Pianificazione Ritiri', icon: Car },
    { id: 'collaudi', label: 'Collaudi', icon: CheckSquare },
    { id: 'riepilogo', label: 'Riepilogo', icon: ClipboardList },
    { id: 'chat', label: 'Chat & Azioni', icon: MessageCircle },
    { id: 'parcheggio', label: 'Parcheggio', icon: MapPin },
    { id: 'telai', label: 'Telai in Attesa di Ordine', icon: Hash },
    { id: 'kits', label: 'Materiale LDK a Stock', icon: Package },
    { id: 'analisi', label: 'Analisi', icon: BarChart3 },
    { id: 'backup', label: 'Backup Locale', icon: HardDrive, adminOnly: true }
  ];

  const pages = allPages.filter(p => {
    if (p.adminOnly && !isAdmin) return false;
    if (isOmologatore && !['riepilogo', 'file-montaggi', 'collaudi'].includes(p.id)) return false;
    return true;
  });

  if (!currentUser) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Toast Notification Chat */}
      {notification && (
        <Toast message={notification} type="info" onClose={clearNotification} />
      )}

      {/* Toast Notifiche Sistema */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={clearToast} />
      )}

      {/* Confirm Dialog globale */}
      {confirmDialog && (
        <ConfirmModal
          message={confirmDialog.message}
          onConfirm={() => { confirmDialog.resolve(true); setConfirmDialog(null); }}
          onClose={() => { confirmDialog.resolve(false); setConfirmDialog(null); }}
        />
      )}

      {/* Header */}
      <div className="bg-gradient-to-r from-red-700 via-red-800 to-red-900 text-white shadow-xl sticky top-0 z-40 border-b-4 border-red-500">
        <div className="max-w-screen-2xl mx-auto px-4 py-1.5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <img src={scattoliniLogo} alt="Scattolini Logo" className="h-8 md:h-10" />
              <div className="border-l-2 border-red-300 pl-4 hidden sm:block">
                <h1 className="text-lg md:text-xl font-bold tracking-tight">SSV Manager</h1>
                <p className="text-xs opacity-90 font-light">Gestione Veicoli e Allestimenti</p>
              </div>
            </div>

            {/* Barra di ricerca universale + Esporta Excel - Desktop */}
            {!isOmologatore && (
              <div className="hidden lg:flex items-center gap-2 flex-1 max-w-xl mx-4">
                <UniversalSearch
                  vehicles={vehicles}
                  onSelectVehicle={(vehicle) => {
                    handleEditVehicle(vehicle);
                  }}
                />
                <button
                  onClick={async () => {
                    if ((await exportCompleteXLSX(vehicles, isAdmin, db)) === false)
                      showNotification('Nessun veicolo da esportare.');
                  }}
                  className="flex-shrink-0 bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 text-white text-sm font-medium"
                  title="Esporta situazione completa Excel"
                >
                  <Download size={16} />
                  <span>Excel</span>
                </button>
              </div>
            )}

            <div className="hidden md:flex items-center gap-4">
              <div className="flex items-center gap-2 bg-white bg-opacity-20 px-3 py-1.5 rounded-lg">
                <User size={16} />
                <span className="font-medium text-sm">{userName}</span>
                {isOmologatore && (
                  <span className="text-xs bg-purple-500 bg-opacity-80 text-white px-2 py-0.5 rounded-full font-medium">Omologatore</span>
                )}
              </div>
              {!isReadOnly && (
                <button
                  onClick={() => setShowImportModal(true)}
                  className="bg-white bg-opacity-20 hover:bg-opacity-30 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2"
                  title="Importa CSV"
                >
                  <Upload size={16} />
                </button>
              )}
              {isAdmin && (
                <Dropdown
                  trigger={({ toggle }) => (
                    <button
                      onClick={toggle}
                      className="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                      title="Impostazioni"
                    >
                      <Settings size={18} />
                    </button>
                  )}
                  items={[
                    {
                      label: 'Notifiche Email',
                      icon: Mail,
                      onClick: () => setShowEmailNotificationsModal(true),
                      className: 'text-blue-700 hover:bg-blue-50',
                    },
                    {
                      label: 'Elimina Tutti i Veicoli',
                      icon: Trash2,
                      onClick: () => setShowDeleteAllModal(true),
                      className: 'text-red-600 hover:bg-red-50',
                    },
                  ]}
                />
              )}
              <button
                onClick={() => logout()}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                title="Logout"
              >
                <LogOut size={18} />
                <span className="font-medium">Esci</span>
              </button>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden text-white p-2"
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Desktop */}
      <div className="hidden md:block bg-white shadow-md sticky top-[56px] z-30">
        <div className="max-w-screen-2xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {pages.map(page => {
              const Icon = page.icon;
              return (
                <button
                  key={page.id}
                  onClick={() => handlePageChange(page.id)}
                  className={`flex items-center gap-2 px-6 py-4 font-medium transition-all whitespace-nowrap relative ${
                    currentPage === page.id
                      ? 'border-b-4 border-blue-600 text-blue-600 bg-blue-50'
                      : page.id === 'chat' && unreadMessagesCount > 0
                      ? 'text-red-600 hover:bg-red-50 hover:text-red-700 animate-pulse'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                  }`}
                >
                  <Icon size={20} className={page.id === 'chat' && unreadMessagesCount > 0 ? 'animate-bounce' : ''} />
                  {page.label}
                  {page.id === 'chat' && unreadMessagesCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center shadow-lg ring-2 ring-red-200 animate-pulse">
                      {unreadMessagesCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white shadow-lg absolute top-[56px] left-0 right-0 z-30 max-h-[80vh] overflow-y-auto">
          <div className="p-4 space-y-3">
            {pages.map(page => {
              const Icon = page.icon;
              return (
                <button
                  key={page.id}
                  onClick={() => {
                    handlePageChange(page.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl font-medium transition-all text-base relative active:scale-[0.98] ${
                    currentPage === page.id
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-gray-50 text-gray-700 hover:bg-gray-100 active:bg-gray-200'
                  }`}
                >
                  <Icon size={24} />
                  {page.id === 'chat' && unreadMessagesCount > 0 && (
                    <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold rounded-full h-6 w-6 flex items-center justify-center animate-pulse">
                      {unreadMessagesCount}
                    </span>
                  )}
                  <span className="flex-1 text-left">{page.label}</span>
                </button>
              );
            })}
            <div className="pt-4 border-t space-y-2">
              {!isReadOnly && (
                <button
                  onClick={() => {
                    setShowImportModal(true);
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-green-50 text-green-700 hover:bg-green-100"
                >
                  <Upload size={20} />
                  Importa CSV
                </button>
              )}
              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
              >
                <LogOut size={20} />
                Logout
              </button>
              {isAdmin && (
                <details className="group">
                  <summary className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gray-50 text-gray-700 hover:bg-gray-100 cursor-pointer list-none">
                    <Settings size={20} />
                    Impostazioni Avanzate
                    <ChevronDown size={16} className="ml-auto group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="mt-2 ml-4 space-y-2">
                    <button
                      onClick={() => {
                        setShowEmailNotificationsModal(true);
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm"
                    >
                      <Mail size={16} />
                      Notifiche Email
                    </button>
                    <button
                      onClick={() => {
                        setShowDeleteAllModal(true);
                        setMobileMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-sm"
                    >
                      <Trash2 size={16} />
                      Elimina Tutti i Veicoli
                    </button>
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-screen-2xl mx-auto px-4 py-6">
        {/* Alert veicoli in scadenza - Solo su officina, file-montaggi, pianificazione-ritiri */}
        {['officina', 'file-montaggi', 'pianificazione-ritiri'].includes(currentPage) && (
          <div className="mb-6">
            <ExpiringVehiclesAlert
              vehicles={vehicles}
              onSelectVehicle={(vehicle) => {
                handleEditVehicle(vehicle);
              }}
            />
          </div>
        )}

        {loadingVehicles && (
          <div className="flex flex-col items-center justify-center py-24 text-gray-500">
            <div className="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm font-medium">Caricamento veicoli...</p>
          </div>
        )}

        <React.Suspense fallback={
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          {!loadingVehicles && currentPage === 'file-montaggi' && (
            <FileMonitaggiPage
              vehicles={vehicles}
              onAddVehicle={handleAddVehicle}
              onEditVehicle={handleEditVehicle}
              onDeleteVehicle={handleDeleteVehicle}
              onCopyVehicle={handleCopyVehicle}
            />
          )}
          {!loadingVehicles && currentPage === 'officina' && (
            <OfficinaPage
              vehicles={vehicles}
              userName={userName}
              onEditVehicle={handleEditVehicle}
            />
          )}
          {!loadingVehicles && currentPage === 'parcheggio' && (
            <ParcheggioPage
              vehicles={vehicles}
              userName={userName}
              onEditVehicle={handleEditVehicle}
            />
          )}
          {!loadingVehicles && currentPage === 'pianificazione-ritiri' && (
            <PianificazioneRitiriPage
              vehicles={vehicles}
              onEditVehicle={handleEditVehicle}
              userName={userName}
            />
          )}
          {!loadingVehicles && currentPage === 'riepilogo' && (
            <RiepilogoPage
              vehicles={vehicles}
              onEditVehicle={handleEditVehicle}
              onDeleteVehicle={handleDeleteVehicle}
            />
          )}
          {!loadingVehicles && currentPage === 'collaudi' && (
            <CollaudiPage
              vehicles={vehicles}
              onEditVehicle={handleEditVehicle}
              userName={userName}
            />
          )}
          {!loadingVehicles && currentPage === 'analisi' && <AnalisiStatistichePage vehicles={vehicles} />}
          {currentPage === 'telai' && <TelaiPage userName={userName} />}
          {currentPage === 'kits' && <KitsPage userName={userName} />}
          {currentPage === 'chat' && <ChatAzioniPage userName={userName} onNewMessage={showNotification} />}
          {currentPage === 'backup' && isAdmin && <BackupExport db={db} userName={userName} isAdmin={isAdmin} />}
        </React.Suspense>
      </div>

      {/* Modals */}
      {showVehicleModal && (
        <VehicleModal
          vehicle={editingVehicle}
          onClose={() => {
            setShowVehicleModal(false);
            setEditingVehicle(null);
          }}
          onSave={handleSaveVehicle}
          onDelete={editingVehicle ? async () => {
            const deleted = await handleDeleteVehicle(editingVehicle.id);
            if (deleted) {
              setShowVehicleModal(false);
              setEditingVehicle(null);
            }
          } : undefined}
        />
      )}

      {showCopyModal && vehicleToCopy && (
        <CopyDateModal
          vehicle={vehicleToCopy}
          onClose={() => {
            setShowCopyModal(false);
          }}
          onCopy={handleConfirmCopy}
        />
      )}

      {showDeleteAllModal && (
        <DeleteAllModal
          onClose={() => setShowDeleteAllModal(false)}
          onConfirm={handleDeleteAll}
          vehicleCount={vehicles.length}
        />
      )}

      {showImportModal && (
        <ImportCSVModal
          onClose={() => setShowImportModal(false)}
          onImport={() => {
            setShowImportModal(false);
          }}
        />
      )}

      {showEmailNotificationsModal && (
        <EmailNotificationsModal onClose={() => setShowEmailNotificationsModal(false)} />
      )}

      {/* Vercel Speed Insights */}
      <SpeedInsights />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <UserProvider>
            <AppContent />
          </UserProvider>
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
