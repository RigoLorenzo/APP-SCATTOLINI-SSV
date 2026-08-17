import { useMemo } from 'react';

/**
 * Filtra l'array veicoli per status, memoizzato. Centralizza il pattern
 * `vehicles.filter(v => v.status === 'x')` ripetuto (senza useMemo) in
 * OfficinaPage, RiepilogoPage, ParcheggioPage, PianificazioneRitiriPage,
 * AnalisiStatistichePage — vedi ARCHITETTURA_SSV_MANAGER.md §6/§10.
 *
 * @param {Array} vehicles
 * @param {string[]} statuses - status da includere; array vuoto/omesso = nessun filtro (tutti i veicoli)
 */
export function useFilteredVehicles(vehicles, statuses = []) {
  // `key` è la rappresentazione stabile del contenuto di `statuses`: la sua
  // identità di array cambia ad ogni render anche a parità di contenuto,
  // quindi si usa `key` (stringa primitiva) come dipendenza reale.
  const key = statuses.join('|');
  return useMemo(() => {
    if (statuses.length === 0) return vehicles;
    return vehicles.filter(v => statuses.includes(v.status));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles, key]);
}
