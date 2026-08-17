import { useState } from 'react';
import { CheckCircle, Clock, Filter, Package, X } from 'lucide-react';
import { useNotification } from '../contexts/NotificationContext';
import { fmtDMY } from '../utils/dateUtils';
import ChartCanvas from '../components/ChartCanvas';

const AnalisiStatistichePage = ({ vehicles }) => {
  const { showToast } = useNotification();
  // Calcola anni disponibili dai dati
  const availableYears = [...new Set(vehicles
    .filter(v => v.dataConsegna)
    .map(v => new Date(v.dataConsegna).getFullYear())
  )].sort((a, b) => b - a);

  const currentYear = new Date().getFullYear();

  const [filters, setFilters] = useState({
    tipoAllestimento: '',
    committente: '',
    dateFrom: '',
    dateTo: '',
    anno: currentYear.toString()
  });

  // Filtra veicoli in base a tutti i filtri
  const filteredVehicles = vehicles.filter(v => {
    if (filters.tipoAllestimento && v.tipoAllestimento !== filters.tipoAllestimento) return false;
    if (filters.committente && v.committente !== filters.committente) return false;
    if (filters.dateFrom && v.dataConsegna < filters.dateFrom) return false;
    if (filters.dateTo && v.dataConsegna > filters.dateTo) return false;
    if (filters.anno && v.dataConsegna) {
      const vehicleYear = new Date(v.dataConsegna).getFullYear();
      if (vehicleYear !== parseInt(filters.anno)) return false;
    }
    return true;
  });

  const selectedYear = parseInt(filters.anno) || currentYear;
  const vehiclesSelectedYear = filteredVehicles.filter(v => {
    if (!v.dataConsegna) return false;
    return new Date(v.dataConsegna).getFullYear() === selectedYear;
  });

  // Calcola tempo medio in-allestimento -> pronto (dataMontaggio -> dataConsegna)
  const calculateAverageTime = () => {
    const validVehicles = filteredVehicles.filter(v =>
      v.dataMontaggio && v.dataConsegna &&
      (v.status === 'pronto' || v.status === 'ritirato')
    );
    if (validVehicles.length === 0) return 0;

    const totalDays = validVehicles.reduce((sum, v) => {
      const start = new Date(v.dataMontaggio);
      const end = new Date(v.dataConsegna);
      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      return sum + Math.max(diffDays, 0);
    }, 0);

    return Math.round(totalDays / validVehicles.length);
  };

  // Calcola tempo medio in-allestimento -> pronto per mese
  const calculateLeadTimeByMonth = () => {
    const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const leadTimeByMonth = {};
    months.forEach((_, i) => { leadTimeByMonth[i] = { totalDays: 0, count: 0 }; });

    filteredVehicles.forEach(v => {
      if (v.dataMontaggio && v.dataConsegna && (v.status === 'pronto' || v.status === 'ritirato')) {
        const startDate = new Date(v.dataMontaggio);
        const endDate = new Date(v.dataConsegna);
        
        if (startDate.getFullYear() === selectedYear) {
          const month = startDate.getMonth();
          const diffDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
          if (diffDays >= 0) {
            leadTimeByMonth[month].totalDays += diffDays;
            leadTimeByMonth[month].count += 1;
          }
        }
      }
    });

    return months.map((month, i) => ({
      label: month,
      value: leadTimeByMonth[i].count > 0 ? Math.round(leadTimeByMonth[i].totalDays / leadTimeByMonth[i].count) : 0,
      color: '#A78BFA',
      colorDark: '#7C3AED'
    }));
  };

  // Calcola veicoli completati per mese
  const calculateCompletionByMonth = () => {
    const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const completedByMonth = {};
    months.forEach((_, i) => { completedByMonth[i] = 0; });

    filteredVehicles.forEach(v => {
      if (v.dataConsegna && (v.status === 'pronto' || v.status === 'ritirato')) {
        const date = new Date(v.dataConsegna);
        if (date.getFullYear() === selectedYear) {
          completedByMonth[date.getMonth()]++;
        }
      }
    });

    return months.map((month, i) => ({
      label: month,
      value: completedByMonth[i],
      color: '#34D399',
      colorDark: '#059669'
    }));
  };

  // NUOVO: Calcola veicoli inseriti per mese (basato su dataArrivo)
  const calculateVehiclesAddedByMonth = () => {
    const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
    const addedByMonth = {};
    months.forEach((_, i) => { addedByMonth[i] = 0; });

    filteredVehicles.forEach(v => {
      if (v.dataArrivo) {
        const date = new Date(v.dataArrivo);
        if (date.getFullYear() === selectedYear) {
          addedByMonth[date.getMonth()]++;
        }
      }
    });

    return months.map((month, i) => ({
      label: month,
      value: addedByMonth[i],
      color: '#FB923C',
      colorDark: '#EA580C'
    }));
  };

  const avgTime = calculateAverageTime();
  const leadTimeData = calculateLeadTimeByMonth();
  const completionData = calculateCompletionByMonth();
  const vehiclesAddedData = calculateVehiclesAddedByMonth();

  // Veicoli per mese (consegne programmate)
  const vehiclesByMonth = {};
  const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
  months.forEach((_, i) => { vehiclesByMonth[i] = 0; });

  vehiclesSelectedYear.forEach(v => {
    if (!v.dataConsegna) return;
    const date = new Date(v.dataConsegna);
    vehiclesByMonth[date.getMonth()]++;
  });

  const monthChartData = months.map((month, i) => ({
    label: month,
    value: vehiclesByMonth[i],
    color: '#60A5FA',
    colorDark: '#2563EB'
  }));

  // Tipi allestimento (esclusi centinato e frigo)
  const uniqueAllestimenti = [...new Set(vehicles.map(v => v.tipoAllestimento).filter(Boolean))]
    .filter(tipo => tipo !== 'centinato' && tipo !== 'frigo');
  const allestimentiColors = [
    { color: '#F87171', colorDark: '#DC2626' },
    { color: '#FBBF24', colorDark: '#D97706' },
    { color: '#34D399', colorDark: '#059669' },
    { color: '#60A5FA', colorDark: '#2563EB' },
    { color: '#A78BFA', colorDark: '#7C3AED' },
    { color: '#F472B6', colorDark: '#DB2777' }
  ];
  const typeChartData = uniqueAllestimenti.map((tipo, i) => ({
    label: tipo,
    value: filteredVehicles.filter(v => v.tipoAllestimento === tipo).length,
    color: allestimentiColors[i % allestimentiColors.length].color,
    colorDark: allestimentiColors[i % allestimentiColors.length].colorDark
  })).filter(item => item.value > 0);

  // Stati veicolo
  const statusConfig = [
    { status: 'da-allestire', label: 'Da Allestire', color: '#F87171', colorDark: '#DC2626' },
    { status: 'in-allestimento', label: 'In Allestimento', color: '#FBBF24', colorDark: '#D97706' },
    { status: 'pronto', label: 'Pronto', color: '#34D399', colorDark: '#059669' },
    { status: 'ritirato', label: 'Ritirato', color: '#60A5FA', colorDark: '#2563EB' }
  ];

  const statusChartData = statusConfig.map(s => ({
    label: s.label,
    value: filteredVehicles.filter(v => v.status === s.status).length,
    color: s.color,
    colorDark: s.colorDark
  })).filter(item => item.value > 0);

  // Committenti unici
  const uniqueCommittenti = [...new Set(vehicles.map(v => v.committente).filter(Boolean))];

  // Top committenti per volume
  const committentiVolume = {};
  filteredVehicles.forEach(v => {
    if (v.committente) {
      committentiVolume[v.committente] = (committentiVolume[v.committente] || 0) + 1;
    }
  });
  const topCommittenti = Object.entries(committentiVolume)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map((entry, i) => ({
      label: entry[0].length > 15 ? entry[0].substring(0, 15) + '...' : entry[0],
      value: entry[1],
      color: ['#60A5FA', '#34D399', '#FBBF24', '#F87171', '#A78BFA', '#F472B6'][i],
      colorDark: ['#2563EB', '#059669', '#D97706', '#DC2626', '#7C3AED', '#DB2777'][i]
    }));

  const resetFilters = () => {
    setFilters({
      tipoAllestimento: '',
      committente: '',
      dateFrom: '',
      dateTo: '',
      anno: currentYear.toString()
    });
  };

  const yearsForFilter = [...new Set([
    ...availableYears,
    currentYear,
    currentYear - 1,
    currentYear - 2,
    currentYear - 3,
    currentYear - 4
  ])].sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Analisi e Statistiche
          </h2>
          <p className="text-sm text-gray-500 mt-1">Panoramica completa dei dati aziendali</p>
        </div>
      </div>

      {/* FILTRI */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Filter size={20} className="text-blue-600" />
          </div>
          <h3 className="font-bold text-lg text-gray-800">Filtri Avanzati</h3>
          {(filters.tipoAllestimento || filters.committente || filters.dateFrom || filters.dateTo || filters.anno !== currentYear.toString()) && (
            <button onClick={resetFilters} className="ml-auto text-sm text-red-500 hover:text-red-600 flex items-center gap-1 font-medium">
              <X size={16} />
              Reset
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Anno</label>
            <select className="w-full border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all" value={filters.anno} onChange={(e) => setFilters({ ...filters, anno: e.target.value })}>
              <option value="">Tutti gli anni</option>
              {yearsForFilter.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Tipo Allestimento</label>
            <select className="w-full border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all" value={filters.tipoAllestimento} onChange={(e) => setFilters({ ...filters, tipoAllestimento: e.target.value })}>
              <option value="">Tutti</option>
              {uniqueAllestimenti.map(tipo => (
                <option key={tipo} value={tipo}>{tipo}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Committente</label>
            <select className="w-full border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all" value={filters.committente} onChange={(e) => setFilters({ ...filters, committente: e.target.value })}>
              <option value="">Tutti</option>
              {uniqueCommittenti.map(comm => (
                <option key={comm} value={comm}>{comm}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Data Da</label>
            <input type="date" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1.5">Data A</label>
            <input type="date" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 bg-gray-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
          </div>
        </div>
      </div>

      {/* STATISTICHE RIASSUNTIVE - RIMOSSO COLLAUDO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 text-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-white bg-opacity-20 rounded-xl">
              <Package size={28} />
            </div>
            <span className="text-4xl font-bold">{filteredVehicles.length}</span>
          </div>
          <p className="text-base font-medium opacity-90">Totale Veicoli</p>
          <p className="text-sm opacity-70 mt-1">{vehiclesSelectedYear.length} nel {selectedYear}</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700 text-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-white bg-opacity-20 rounded-xl">
              <CheckCircle size={28} />
            </div>
            <span className="text-4xl font-bold">{filteredVehicles.filter(v => v.status === 'pronto' || v.status === 'ritirato').length}</span>
          </div>
          <p className="text-base font-medium opacity-90">Completati</p>
          <p className="text-sm opacity-70 mt-1">Pronti + Ritirati</p>
        </div>

        <div className="bg-gradient-to-br from-amber-400 via-amber-500 to-orange-500 text-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-white bg-opacity-20 rounded-xl">
              <Clock size={28} />
            </div>
            <span className="text-4xl font-bold">{avgTime}</span>
          </div>
          <p className="text-base font-medium opacity-90">Giorni Medi Allestimento</p>
          <p className="text-sm opacity-80 mt-1">In Allestimento → Pronto</p>
        </div>
      </div>

      {/* GRAFICI PRINCIPALI */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCanvas data={monthChartData} title={`Consegne Programmate per Mese (${selectedYear})`} type="bar" />
        <ChartCanvas data={vehiclesAddedData} title={`Veicoli Inseriti per Mese (${selectedYear})`} type="bar" />
      </div>

      {/* GRAFICI PERFORMANCE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCanvas data={leadTimeData} title={`Tempo Medio Allestimento — giorni (${selectedYear})`} type="bar" />
        <ChartCanvas data={completionData} title={`Veicoli Completati per Mese (${selectedYear})`} type="bar" />
      </div>

      {/* GRAFICI DISTRIBUZIONE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {statusChartData.length > 0 && (
          <ChartCanvas data={statusChartData} title="Distribuzione per Stato" type="pie" />
        )}
        {typeChartData.length > 0 && (
          <ChartCanvas data={typeChartData} title="Distribuzione per Tipo Allestimento" type="pie" />
        )}
      </div>

      {/* TOP COMMITTENTI */}
      {topCommittenti.length > 0 && (
        <ChartCanvas data={topCommittenti} title="Top Committenti per Volume" type="bar" />
      )}
    </div>
  );
};


export default AnalisiStatistichePage;
