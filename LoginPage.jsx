import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Lock, Mail, AlertCircle, LogIn } from 'lucide-react';
import scattoliniLogo from '../logo_scattolinivert-Xc8Z6.jpg';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
    } catch (err) {
      // Gestione errori Firebase
      switch (err.code) {
        case 'auth/invalid-email':
          setError('Email non valida');
          break;
        case 'auth/user-disabled':
          setError('Questo account è stato disabilitato');
          break;
        case 'auth/user-not-found':
          setError('Utente non trovato');
          break;
        case 'auth/wrong-password':
          setError('Password errata');
          break;
        case 'auth/invalid-credential':
          setError('Credenziali non valide');
          break;
        case 'auth/too-many-requests':
          setError('Troppi tentativi. Riprova più tardi');
          break;
        default:
          setError('Errore durante l\'autenticazione');
          console.error(err);
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header con logo */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-8 text-white text-center">
          <div className="flex justify-center mb-4">
            <img src={scattoliniLogo} alt="Scattolini Logo" className="h-16 w-auto" />
          </div>
          <h1 className="text-2xl font-bold">Scattolini SSV</h1>
          <p className="text-blue-100 mt-2">Sistema di Gestione Veicoli</p>
        </div>

        {/* Form */}
        <div className="p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">Accedi</h2>
          <p className="text-gray-600 text-sm mb-6 text-center">
            Inserisci le tue credenziali per accedere al sistema
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle size={20} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="email@esempio.it"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Accesso in corso...
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  Accedi
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t text-center">
            <p className="text-xs text-gray-500">
              Gli utenti vengono creati dall'amministratore del sistema.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Per richiedere l'accesso, contatta l'amministratore.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
