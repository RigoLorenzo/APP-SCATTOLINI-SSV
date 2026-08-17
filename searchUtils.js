/**
 * Ricerca full-field centralizzata sui veicoli: fa match case-insensitive e
 * parziale su qualsiasi campo compilato del documento (incluso dentro
 * oggetti annidati come `clienteAvvisato` e i nomi file di `files`/`distinta`),
 * non solo sul sottoinsieme storico telaio/matricola/committente/ordineSAP.
 * Riusata da UniversalSearch, VehiclePickerList e dalle pagine con ricerca
 * locale (Officina, Riepilogo, File Montaggi, Pianificazione Ritiri,
 * Collaudi, Parcheggio), al posto delle liste di campi duplicate e
 * disallineate tra loro che c'erano prima in ciascun file.
 *
 * La ricerca resta interamente client-side sui `vehicles` già caricati da
 * `useVehicles()` (nessuna query Firestore per carattere digitato). Il testo
 * di ricerca di ogni veicolo viene precalcolato una sola volta per oggetto
 * (cache via WeakMap) invece che ricalcolato ad ogni carattere digitato.
 */

const searchTextCache = new WeakMap();

// Il doc id Firestore non è un dato inserito dall'utente: escluso dal match.
const EXCLUDED_KEYS = new Set(['id']);

function flattenValue(value, depth) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean' || depth > 2) return '';
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item : item?.name || ''))
      .join(' ');
  }
  if (typeof value === 'object') {
    return Object.values(value).map((v) => flattenValue(v, depth + 1)).join(' ');
  }
  return '';
}

function buildSearchText(vehicle) {
  return Object.entries(vehicle)
    .filter(([key]) => !EXCLUDED_KEYS.has(key))
    .map(([, value]) => flattenValue(value, 0))
    .join(' ')
    .toLowerCase();
}

function getSearchText(vehicle) {
  let cached = searchTextCache.get(vehicle);
  if (cached === undefined) {
    cached = buildSearchText(vehicle);
    searchTextCache.set(vehicle, cached);
  }
  return cached;
}

/** True se il veicolo fa match col termine su un qualsiasi campo compilato. */
export function searchVehicle(vehicle, searchTerm) {
  if (!vehicle || !searchTerm || !searchTerm.trim()) return true;
  return getSearchText(vehicle).includes(searchTerm.toLowerCase().trim());
}

/** Filtra un array di veicoli per termine di ricerca full-field. */
export function filterVehiclesBySearch(vehicles, searchTerm) {
  if (!searchTerm || !searchTerm.trim()) return vehicles;
  const term = searchTerm.toLowerCase().trim();
  return vehicles.filter((v) => getSearchText(v).includes(term));
}
