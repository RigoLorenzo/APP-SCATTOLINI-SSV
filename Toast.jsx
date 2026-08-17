import React, { useEffect } from 'react';
import { Bell, X, AlertTriangle, CheckCircle, Info } from 'lucide-react';

/**
 * Componente Toast per notifiche
 * @param {string} message - Messaggio da mostrare
 * @param {string} type - Tipo di notifica (info, success, warning, error)
 * @param {Function} onClose - Callback per chiusura
 */
const Toast = ({ message, type = 'info', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={24} className="animate-bounce" />;
      case 'warning':
        return <AlertTriangle size={24} className="animate-bounce" />;
      case 'error':
        return <AlertTriangle size={24} className="animate-bounce" />;
      default:
        return <Bell size={24} className="animate-bounce" />;
    }
  };

  const getColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-600';
      case 'warning':
        return 'bg-yellow-600';
      case 'error':
        return 'bg-red-600';
      default:
        return 'bg-blue-600';
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'success':
        return 'Successo';
      case 'warning':
        return 'Attenzione';
      case 'error':
        return 'Errore';
      default:
        return 'Notifica';
    }
  };

  return (
    <div className="fixed top-20 right-4 z-50 animate-slide-in">
      <div className={`${getColor()} text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 max-w-md`}>
        {getIcon()}
        <div className="flex-1">
          <p className="font-semibold">{getTitle()}</p>
          <p className="text-sm opacity-90">{message}</p>
        </div>
        <button onClick={onClose} className="text-white hover:opacity-75 rounded p-1">
          <X size={20} />
        </button>
      </div>
    </div>
  );
};

export default Toast;
