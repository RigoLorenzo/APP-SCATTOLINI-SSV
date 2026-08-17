import { createContext, useContext, useState } from 'react';

export const NotificationContext = createContext();
export const useNotification = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const [toast, setToast] = useState(null);
  const [notification, setNotification] = useState(null);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  const [confirmDialog, setConfirmDialog] = useState(null);

  const showNotification = (message) => {
    setNotification(message);
    setUnreadMessagesCount(prev => prev + 1);
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Nuovo Messaggio Chat', {
        body: message,
        icon: '/vite.svg',
        tag: 'chat-notification'
      });
    }
  };

  const clearNotification = () => setNotification(null);
  const showToast = (message, type = 'info') => setToast({ message, type });
  const clearToast = () => setToast(null);
  const resetUnreadMessages = () => setUnreadMessagesCount(0);
  const showConfirm = (message) => new Promise((resolve) => {
    setConfirmDialog({ message, resolve });
  });

  const value = {
    toast, clearToast,
    notification, clearNotification,
    unreadMessagesCount, resetUnreadMessages,
    showNotification,
    showToast,
    showConfirm,
    confirmDialog, setConfirmDialog,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};
