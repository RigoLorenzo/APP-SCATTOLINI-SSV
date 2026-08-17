import { fmtDMY } from './dateUtils';

/**
 * Helper centralizzato per leggere/interpretare il campo `collaudo` del
 * veicolo, incluso il nuovo stato "pianificato" introdotto per
 * l'assegnazione da calendario nella pagina Collaudi. Da riusare ovunque
 * si legga/mostri questo campo (VehicleModal, VehicleCard, CollaudiPage,
 * ParcheggioPage, dateUtils.getVehicleStatusLabel) per evitare parsing
 * duplicato e divergenze.
 *
 * Valori possibili di `collaudo`: 'da-collaudare' (default) | 'pianificato'
 * (NUOVO) | 'allestimento-omologato' | 'collaudo-eseguito' | 'non-richiesto'.
 *
 * Retrocompatibilità: documenti pre-esistenti con `collaudo: 'da-collaudare'`
 * e `dataCollaudo` già valorizzata (l'unico modo in cui una data di collaudo
 * poteva essere impostata prima di questa feature) sono trattati come
 * "pianificati" ai fini di visualizzazione/filtri, pur mantenendo invariato
 * il valore grezzo salvato su Firestore.
 */

export const COLLAUDO_OPTIONS = [
  { value: 'da-collaudare', label: 'Da Collaudare' },
  { value: 'pianificato', label: 'Pianificato' },
  { value: 'allestimento-omologato', label: 'Allestimento Omologato' },
  { value: 'collaudo-eseguito', label: 'Eseguito' },
  { value: 'non-richiesto', label: 'Collaudo / Omologazione non richiesti' },
];

/** True se il valore grezzo indica una data pianificata (nuovo stato esplicito o legacy da-collaudare+data). */
export const isCollaudoPlanned = (vehicle) =>
  vehicle?.collaudo === 'pianificato' || (vehicle?.collaudo === 'da-collaudare' && !!vehicle?.dataCollaudo);

/** True se il collaudo deve ancora essere eseguito (pianificato o meno) — usato per warning/badge "attenzione". */
export const isCollaudoPending = (vehicle) =>
  vehicle?.collaudo === 'da-collaudare' || vehicle?.collaudo === 'pianificato';

export const isCollaudoDone = (vehicle) => vehicle?.collaudo === 'collaudo-eseguito';

/** Veicoli rilevanti per il calendario Collaudi: da fare (con o senza data), pianificati, eseguiti. */
export const isCollaudoCalendarRelevant = (vehicle) =>
  isCollaudoPending(vehicle) || isCollaudoDone(vehicle);

/** Pool di veicoli assegnabili da calendario: da collaudare, ancora senza data pianificata. */
export const getUnplannedCollaudoVehicles = (vehicles) =>
  vehicles.filter((v) => v.collaudo === 'da-collaudare' && !v.dataCollaudo);

/** Etichetta breve con emoji per badge calendario/card. */
export const formatCollaudoBadge = (vehicle) => {
  if (isCollaudoDone(vehicle)) return '✅ Collaudo Eseguito';
  return '📅 Pianificato';
};

/** Etichetta breve senza calendario (per VehicleCard variant detail). */
export const formatCollaudoShort = (vehicle) => {
  if (isCollaudoDone(vehicle)) return '✅ Fatto';
  if (vehicle?.collaudo === 'allestimento-omologato') return '✅ Omologato';
  if (vehicle?.collaudo === 'non-richiesto') return '➖ Non necessario';
  if (isCollaudoPlanned(vehicle)) return `📅 Pianificato (${fmtDMY(vehicle.dataCollaudo)})`;
  return '⏳ Da fare';
};

/** Etichetta estesa per la scheda veicolo: "Pianificato in data: DD/MM/AAAA" quando applicabile. */
export const formatCollaudoField = (vehicle) => {
  if (isCollaudoPlanned(vehicle) && vehicle?.dataCollaudo) {
    return `Pianificato in data: ${fmtDMY(vehicle.dataCollaudo)}`;
  }
  const opt = COLLAUDO_OPTIONS.find((o) => o.value === vehicle?.collaudo);
  return opt ? opt.label : COLLAUDO_OPTIONS[0].label;
};
