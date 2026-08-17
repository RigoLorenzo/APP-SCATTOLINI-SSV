/**
 * Valida i campi obbligatori di un veicolo
 * @param {Object} vehicle - Oggetto veicolo da validare
 * @returns {Object} { isValid: boolean, errors: Array<string> }
 */
export function validateVehicle(vehicle) {
  const errors = [];

  // Campi obbligatori
  if (!vehicle.committente || vehicle.committente.trim() === '') {
    errors.push('Il campo "Committente" è obbligatorio');
  }

  if (!vehicle.dataConsegna || vehicle.dataConsegna.trim() === '') {
    errors.push('Il campo "Data Consegna" è obbligatorio');
  }

  if (!vehicle.tipoAllestimento || vehicle.tipoAllestimento.trim() === '') {
    errors.push('Il campo "Tipo Allestimento" è obbligatorio');
  }

  // Validazione formato data (se presente)
  if (vehicle.dataConsegna) {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(vehicle.dataConsegna)) {
      errors.push('Il formato della "Data Consegna" non è valido (deve essere YYYY-MM-DD)');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
