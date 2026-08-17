import { useState, useEffect } from 'react';
import { Mail, Plus, Trash2, Save, Bell, RefreshCw, CheckCircle, CalendarClock } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useNotification } from '../../contexts/NotificationContext';
import Modal from '../Common/Modal';

// ─── Pannello configurazione di una singola notifica ─────────────────────────

function NotificationPanel({ docPath, accentColor }) {
  const { showToast } = useNotification();
  const [enabled, setEnabled]       = useState(true);
  const [recipients, setRecipients] = useState([]);
  const [newEmail, setNewEmail]     = useState('');
  const [saving, setSaving]         = useState(false);
  const [loading, setLoading]       = useState(true);

  useEffect(() => { load(); }, [docPath]);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'config', docPath));
      if (snap.exists()) {
        const d = snap.data();
        setEnabled(d.enabled !== false);
        setRecipients(Array.isArray(d.recipients) ? d.recipients : []);
      } else {
        setEnabled(true);
        setRecipients([]);
      }
    } catch {
      showToast('Errore nel caricamento configurazione.', 'error');
    } finally {
      setLoading(false);
    }
  }

  function isValidEmail(e) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
  }

  function addRecipient() {
    const trimmed = newEmail.trim().toLowerCase();
    if (!isValidEmail(trimmed)) { showToast('Indirizzo email non valido.', 'error'); return; }
    if (recipients.includes(trimmed)) { showToast('Email già presente.', 'error'); return; }
    setRecipients(prev => [...prev, trimmed]);
    setNewEmail('');
  }

  async function save() {
    setSaving(true);
    try {
      await setDoc(doc(db, 'config', docPath), { enabled, recipients }, { merge: true });
      showToast('Configurazione salvata.', 'success');
    } catch {
      showToast('Errore nel salvataggio.', 'error');
    } finally {
      setSaving(false);
    }
  }

  const toggleOn  = accentColor === 'red' ? 'bg-red-500' : 'bg-amber-500';
  const btnBorder = accentColor === 'red' ? 'border-red-200' : 'border-amber-200';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
        <RefreshCw size={16} className="animate-spin" />
        <span className="text-sm">Caricamento...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">

      {/* Toggle attivo / disattivo */}
      <div className={`flex items-center justify-between p-3 rounded-xl border ${btnBorder} bg-white`}>
        <div>
          <p className="text-sm font-semibold text-gray-800">
            {enabled ? 'Notifica attiva' : 'Notifica disattivata'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {enabled ? 'Le email vengono inviate ai destinatari configurati.' : 'Nessuna email verrà inviata.'}
          </p>
        </div>
        <button
          onClick={() => setEnabled(v => !v)}
          className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? toggleOn : 'bg-gray-300'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${enabled ? 'left-6' : 'left-0.5'}`} />
        </button>
      </div>

      {/* Lista destinatari */}
      <div>
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
          Destinatari ({recipients.length})
        </p>
        <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
          {recipients.length === 0 && (
            <div className="text-center py-6 text-gray-400 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
              Nessun destinatario configurato
            </div>
          )}
          {recipients.map(email => (
            <div key={email} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm group">
              <div className="flex items-center gap-2 min-w-0">
                <Mail size={13} className="text-gray-400 flex-shrink-0" />
                <span className="text-gray-700 font-medium truncate">{email}</span>
              </div>
              <button
                onClick={() => setRecipients(prev => prev.filter(e => e !== email))}
                className="flex-shrink-0 ml-2 text-gray-300 hover:text-red-500 transition-colors"
                title="Rimuovi"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Aggiungi */}
      <div className="flex gap-2">
        <input
          type="email"
          placeholder="nome@azienda.it"
          value={newEmail}
          onChange={e => setNewEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addRecipient()}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-blue-400 focus:ring-1 focus:ring-blue-200 outline-none"
        />
        <button
          onClick={addRecipient}
          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5 text-sm font-medium"
        >
          <Plus size={14} />
          Aggiungi
        </button>
      </div>

      {/* Salva */}
      <button
        onClick={save}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors text-sm font-semibold disabled:opacity-60"
      >
        {saving
          ? <><RefreshCw size={15} className="animate-spin" /> Salvataggio...</>
          : <><Save size={15} /> Salva modifiche</>
        }
      </button>
    </div>
  );
}

// ─── Modal principale con tabs ────────────────────────────────────────────────

const TABS = [
  {
    id:          'ready',
    label:       'Veicolo Pronto',
    icon:        CheckCircle,
    docPath:     'emailNotifications',
    accentColor: 'red',
    badge:       'In tempo reale',
    badgeColor:  'bg-red-100 text-red-700',
    description: 'Email inviata automaticamente ogni volta che un veicolo passa da "In Allestimento" a "Pronto". I destinatari ricevono subito la notifica con tutti i dettagli del veicolo.',
  },
  {
    id:          'weekly',
    label:       'Report Settimanale',
    icon:        CalendarClock,
    docPath:     'weeklyReport',
    accentColor: 'amber',
    badge:       'Ogni lunedì 08:00',
    badgeColor:  'bg-amber-100 text-amber-700',
    description: 'Report automatico ogni lunedì mattina con l\'elenco di tutti i veicoli attivi privi di COC ricevuto e privi di pagamento documenti confermato.',
  },
];

const EmailNotificationsModal = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('ready');
  const tab = TABS.find(t => t.id === activeTab);

  return (
    <Modal
      title={
        <div className="flex items-center gap-3">
          <div className="bg-white bg-opacity-20 p-2 rounded-lg">
            <Mail size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold leading-tight">Notifiche Email</h2>
            <p className="text-xs text-blue-200 mt-0.5">Gestisci destinatari e report automatici</p>
          </div>
        </div>
      }
      headerColor="blue-dark"
      headerPadding="px-5 py-4"
      headerClassName="flex-shrink-0"
      onClose={onClose}
      closeIconSize={20}
      closeButtonClassName="text-white hover:bg-white hover:bg-opacity-20 p-1.5 rounded-lg transition-colors"
      rounded="2xl"
      shadow="2xl"
      className="flex flex-col"
      style={{ maxHeight: '90vh' }}
      bodyClassName="flex-1 flex flex-col overflow-hidden"
      footer={
        <button
          onClick={onClose}
          className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium"
        >
          Chiudi
        </button>
      }
      footerPadding="px-5 pb-5"
      footerClassName="flex-shrink-0 border-t border-gray-100 pt-3"
    >
      {/* Tabs */}
      <div className="flex border-b border-gray-200 flex-shrink-0">
        {TABS.map(t => {
          const Icon    = t.icon;
          const isActive = t.id === activeTab;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-semibold transition-all border-b-2 ${
                isActive
                  ? t.accentColor === 'red'
                    ? 'border-red-500 text-red-700 bg-red-50'
                    : 'border-amber-500 text-amber-700 bg-amber-50'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.id === 'ready' ? 'Pronto' : 'Settimanale'}</span>
            </button>
          );
        })}
      </div>

      {/* Contenuto tab */}
      <div className="flex-1 overflow-y-auto px-5 pb-4">

        {/* Info contestuale */}
        <div className={`mt-4 flex items-start gap-3 p-3 rounded-xl border ${
          tab.accentColor === 'red'
            ? 'bg-red-50 border-red-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          <Bell size={15} className={`flex-shrink-0 mt-0.5 ${tab.accentColor === 'red' ? 'text-red-600' : 'text-amber-600'}`} />
          <div>
            <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full mb-1 ${tab.badgeColor}`}>
              {tab.badge}
            </span>
            <p className="text-xs text-gray-600 leading-relaxed">{tab.description}</p>
          </div>
        </div>

        {/* Pannello gestione */}
        <NotificationPanel
          key={tab.docPath}
          docPath={tab.docPath}
          accentColor={tab.accentColor}
        />
      </div>
    </Modal>
  );
};

export default EmailNotificationsModal;
