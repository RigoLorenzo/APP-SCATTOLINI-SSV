import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-red-100 p-4 rounded-full">
                <AlertCircle size={40} className="text-red-600" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">Qualcosa è andato storto</h2>
            <p className="text-gray-500 text-sm mb-6">
              Si è verificato un errore imprevisto. Ricarica la pagina per continuare.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 bg-red-600 text-white px-6 py-2.5 rounded-lg hover:bg-red-700 font-medium"
            >
              <RefreshCw size={16} />
              Ricarica la pagina
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
