/**
 * Definizione condivisa dei filtri "Tipo" e "Vista" usati da OfficinaPage e
 * RiepilogoPage, per evitare che le due pagine divergano nel tempo.
 */
export const VISTA_FILTER_DEFS = [
  { id: 'noTelaio', label: 'Senza N° Telaio', predicate: v => !v.numeroTelaio },
  { id: 'noSap', label: 'Senza N° Ordine SAP', predicate: v => !v.ordineSAP },
  { id: 'nonConsegnati', label: 'Non ancora consegnati', predicate: v => !v.dataArrivo },
  { id: 'giaRicevuti', label: 'Veicoli già ricevuti', predicate: v => Boolean(v.dataArrivo) },
  { id: 'noCoc', label: 'COC non ricevuto', predicate: v => !v.cocMandato },
];

export function getAvailableTipiAllestimento(vehicles) {
  return [...new Set(vehicles.map(v => v.tipoAllestimento).filter(Boolean))];
}

export function matchesTipoVistaFilters(vehicle, { selectedTipi = [], vistaIds = [] } = {}) {
  if (selectedTipi.length > 0 && !selectedTipi.includes(vehicle.tipoAllestimento)) return false;
  for (const id of vistaIds) {
    const def = VISTA_FILTER_DEFS.find(d => d.id === id);
    if (def && !def.predicate(vehicle)) return false;
  }
  return true;
}
