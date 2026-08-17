import { fmtDMY } from './dateUtils';

/**
 * Helper centralizzato per leggere/interpretare lo stato di ritiro del
 * veicolo, incluso il campo `statoRitiro` ("pianificato") introdotto per
 * l'assegnazione da calendario nella pagina Pianificazione Ritiri. Da
 * riusare ovunque si legga/mostri questo campo (VehicleModal, VehicleCard,
 * PianificazioneRitiriPage, export).
 *
 * `statoRitiro`: 'da-pianificare' (default) | 'pianificato' | 'svolto'.
 * Retrocompatibilità: se il campo è assente sui documenti pre-esistenti,
 * viene derivato dai campi legacy già in uso (`dataRitiro`, `ritiroSvolto`)
 * — nessuna migrazione dati necessaria.
 *
 * Le 3 modalità (`ritiro`, `consegna`, `montaggio`) sono sempre tutte
 * ammesse ovunque venga fatta l'assegnazione: il vecchio campo
 * `modalitaRitiroConsentite` (restrizione per veicolo) è stato rimosso.
 * Documenti pre-esistenti che hanno ancora quel campo lo ignorano in
 * lettura — nessuna migrazione necessaria.
 */

export const RITIRO_MODALITA_LABELS = {
  ritiro: '📦 Ritiro del Mezzo',
  consegna: '🚗 Consegna',
  montaggio: '🔧 Appuntamento Montaggio',
};

export const ALL_MODALITA_RITIRO = ['ritiro', 'consegna', 'montaggio'];

/** Stato di ritiro derivato: 'da-pianificare' | 'pianificato' | 'svolto'. */
export const getStatoRitiro = (vehicle) => {
  if (vehicle?.statoRitiro) return vehicle.statoRitiro;
  // Derivazione legacy per documenti creati prima di questa feature
  if (vehicle?.ritiroSvolto) return 'svolto';
  if (vehicle?.dataRitiro) return 'pianificato';
  return 'da-pianificare';
};

export const isRitiroPianificato = (vehicle) => getStatoRitiro(vehicle) !== 'da-pianificare';

/** Pool di veicoli assegnabili da calendario Ritiro: pronti, non ancora pianificati. */
export const getUnplannedPickupVehicles = (vehicles) =>
  vehicles.filter((v) => v.status === 'pronto' && !v.dataRitiro);

/** Etichetta estesa per la scheda veicolo, formato coerente con quello di formatCollaudoField. */
export const formatRitiroField = (vehicle) => {
  const stato = getStatoRitiro(vehicle);
  if (stato === 'da-pianificare') return 'Non ancora pianificato';
  const modalitaLabel = RITIRO_MODALITA_LABELS[vehicle?.modalitaRitiro] || vehicle?.modalitaRitiro || '';
  const dataLabel = fmtDMY(vehicle?.dataRitiro);
  const prefix = stato === 'svolto' ? 'Svolto in data' : 'Pianificato in data';
  return `${prefix}: ${dataLabel}${modalitaLabel ? ` — Modalità: ${modalitaLabel}` : ''}`;
};
