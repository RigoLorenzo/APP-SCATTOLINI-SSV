import { useState, useEffect, useRef } from 'react';
import { Clock, MessageCircle, Send } from 'lucide-react';
import { collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useUser } from '../contexts/UserContext';
import { useNotification } from '../contexts/NotificationContext';

const ChatAzioniPage = ({ userName, onNewMessage }) => {
  const { isReadOnly } = useUser();
  const { showToast } = useNotification();
  const [messages, setMessages] = useState([]);
  const [actions, setActions] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const isInitialLoad = useRef(true);
  const prevMessagesCount = useRef(0);

  useEffect(() => {
    const messagesQuery = query(collection(db, 'messages'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'message' }));

      // Rileva nuovi messaggi (solo dopo il caricamento iniziale)
      if (!isInitialLoad.current && msgs.length > prevMessagesCount.current) {
        const newMsg = msgs[0]; // Il più recente
        if (newMsg && newMsg.userName !== userName && onNewMessage) {
          onNewMessage(`${newMsg.userName}: ${newMsg.message}`);
        }
      }

      prevMessagesCount.current = msgs.length;
      isInitialLoad.current = false;
      setMessages(msgs);
    }, (error) => { console.error('messages listener error:', error); showToast('Errore caricamento messaggi.', 'error'); });

    const actionsQuery = query(collection(db, 'actions'), orderBy('timestamp', 'desc'), limit(200));
    const unsubscribeActions = onSnapshot(actionsQuery, (snapshot) => {
      const acts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'action' }));
      setActions(acts);
    }, (error) => { console.error('actions listener error:', error); showToast('Errore caricamento log azioni.', 'error'); });

    return () => {
      unsubscribeMessages();
      unsubscribeActions();
    };
  }, [userName, onNewMessage]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      await addDoc(collection(db, 'messages'), {
        userName,
        message: newMessage.trim(),
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString()
      });
      setNewMessage('');
    } catch (error) {
      console.error('Errore:', error);
    }
  };

  const formatTimestamp = (item) => {
    try {
      let date;
      if (item.timestamp?.toDate) {
        date = item.timestamp.toDate();
      } else if (item.createdAt) {
        date = new Date(item.createdAt);
      } else {
        return '';
      }
      const now = new Date();
      const diff = now - date;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return 'Ora';
      if (minutes < 60) return `${minutes}m fa`;
      if (hours < 24) return `${hours}h fa`;
      if (days < 7) return `${days}g fa`;
      return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);
    } catch (error) {
      return '';
    }
  };

  const getCombinedItems = () => {
    const items = [...messages, ...actions];
    return items.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt) : (a.timestamp?.toDate?.() || new Date(0));
      const timeB = b.createdAt ? new Date(b.createdAt) : (b.timestamp?.toDate?.() || new Date(0));
      return timeB - timeA;
    });
  };

  const combinedItems = getCombinedItems();

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col">
      <div className="mb-4">
        <h2 className="text-2xl font-bold mb-2">Chat e Azioni</h2>
        <p className="text-sm text-gray-600">Comunicazione in tempo reale e log delle attività</p>
      </div>

      <div className="bg-white rounded-t-lg shadow-lg">
        <div className="px-4 py-3 border-b text-sm text-gray-500">
          {messages.length} messaggi &middot; {actions.length} log
        </div>
      </div>

      <div className="flex-1 bg-white shadow-lg p-4 overflow-y-auto">
        {combinedItems.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <MessageCircle size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-lg">Nessun elemento da visualizzare</p>
            <p className="text-sm mt-2">I messaggi e le azioni appariranno qui</p>
          </div>
        ) : (
          <div className="space-y-3">
            {combinedItems.map((item) => (
              <div
                key={item.id}
                className={`rounded-lg p-4 transition-all hover:shadow-md ${
                  item.type === 'message' ? 'bg-blue-50 border-l-4 border-blue-500' : 'bg-gray-50 border-l-4 border-gray-400'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      item.type === 'message' ? 'bg-blue-600' : 'bg-gray-600'
                    } text-white font-bold text-sm`}>
                      {item.userName?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-800">{item.userName}</p>
                      <p className="text-xs text-gray-500">{formatTimestamp(item)}</p>
                    </div>
                  </div>
                  {item.type === 'message' ? <MessageCircle size={16} className="text-blue-600" /> : <Clock size={16} className="text-gray-600" />}
                </div>

                {item.type === 'message' ? (
                  <p className="text-gray-800 ml-10 whitespace-pre-wrap">{item.message}</p>
                ) : (
                  <div className="ml-10">
                    <p className="text-gray-800 font-medium">{item.action}</p>
                    {item.vehicleInfo && Object.keys(item.vehicleInfo).length > 0 && (
                      <div className="mt-1 text-xs text-gray-600 bg-white rounded p-2">
                        <span className="font-medium">Veicolo:</span> {item.vehicleInfo.committente}
                        {item.vehicleInfo.numeroTelaio && ` - Telaio: ${item.vehicleInfo.numeroTelaio}`}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {!isReadOnly && (
        <div className="bg-white shadow-lg rounded-b-lg p-4 border-t">
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 border-2 border-gray-300 rounded-lg px-4 py-3 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all"
              placeholder="Scrivi un messaggio..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button
              onClick={handleSendMessage}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
            >
              <Send size={18} />
              Invia
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatAzioniPage;
