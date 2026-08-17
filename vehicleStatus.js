// Colori/icone di stato veicolo, centralizzati per evitare la duplicazione
// verbatim che esisteva tra VehicleDetailCard e RiepilogoPage (vedi
// ARCHITETTURA_SSV_MANAGER.md §9/§10).
export const VEHICLE_STATUS_CONFIG = {
  'da-allestire': { label: 'Da Allestire', color: 'bg-red-100 border-red-400 text-red-800', icon: '🔴' },
  'in-allestimento': { label: 'In Allestimento', color: 'bg-yellow-100 border-yellow-400 text-yellow-800', icon: '🔧' },
  'pronto': { label: 'Pronto', color: 'bg-green-100 border-green-400 text-green-800', icon: '✅' },
  'ritirato': { label: 'Ritirato', color: 'bg-blue-100 border-blue-400 text-blue-800', icon: '🚚' },
};

export function getVehicleStatusConfig(status) {
  return VEHICLE_STATUS_CONFIG[status] || VEHICLE_STATUS_CONFIG['da-allestire'];
}
