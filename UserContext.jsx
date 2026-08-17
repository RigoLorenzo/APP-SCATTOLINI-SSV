import { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

export const UserContext = createContext();
export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const [userRole, setUserRole] = useState('operativo');

  useEffect(() => {
    if (!currentUser) {
      setUserRole('operativo');
      return;
    }
    const unsubscribe = onSnapshot(
      doc(db, 'users', currentUser.uid),
      (docSnap) => {
        setUserRole(docSnap.exists() ? (docSnap.data().role || 'operativo') : 'operativo');
      },
      (error) => { console.error('users listener error:', error); }
    );
    return unsubscribe;
  }, [currentUser]);

  const userName = currentUser?.displayName || currentUser?.email || 'Utente';
  const isAdmin = userRole === 'admin';
  const isOmologatore = userRole === 'omologatore';
  const isReadOnly = userRole === 'non_operativo' || isOmologatore;

  return (
    <UserContext.Provider value={{ userName, userRole, isAdmin, isReadOnly, isOmologatore }}>
      {children}
    </UserContext.Provider>
  );
};
