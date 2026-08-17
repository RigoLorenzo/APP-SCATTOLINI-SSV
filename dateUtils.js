/**
 * Converte una data in formato ISO (YYYY-MM-DD)
 * @param {Date|string} d - Data da convertire
 * @returns {string} Data in formato ISO
 */
export const toISO = (d) => {
  if (typeof d === 'string') return d;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Formatta una data ISO in formato DD/MM/YYYY
 * @param {string} iso - Data in formato ISO
 * @returns {string} Data formattata DD/MM/YYYY
 */
export const fmtDMY = (iso) => {
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
};

/**
 * Ottiene tutti i giorni di un mese con giorni adiacenti per riempire la griglia
 * @param {number} year - Anno
 * @param {number} month - Mese (0-11)
 * @returns {Array} Array di oggetti {date, isCurrentMonth}
 */
export const getDaysInMonth = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days = [];
  const startDayOfWeek = firstDay.getDay();
  const daysToAdd = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  for (let i = daysToAdd; i > 0; i--) {
    const prevDay = new Date(year, month, 1 - i);
    days.push({ date: prevDay, isCurrentMonth: false });
  }
  for (let day = 1; day <= lastDay.getDate(); day++) {
    days.push({ date: new Date(year, month, day), isCurrentMonth: true });
  }
  const endDayOfWeek = lastDay.getDay();
  const daysToAddEnd = endDayOfWeek === 0 ? 0 : 7 - endDayOfWeek;
  for (let i = 1; i <= daysToAddEnd; i++) {
    const nextDay = new Date(year, month + 1, i);
    days.push({ date: nextDay, isCurrentMonth: false });
  }
  return days;
};

/**
 * Parsa una data da CSV in formato ISO
 * @param {string} dateStr - Data in formato DD/MM/YYYY o ISO
 * @returns {string} Data in formato ISO
 */
export const parseCSVDate = (dateStr) => {
  if (!dateStr || String(dateStr).trim() === '') return '';
  const s = String(dateStr).trim();
  // DD/MM/YYYY o DD-MM-YYYY
  const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  // YYYY-MM-DD o YYYY/MM/DD
  const isoMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return '';
};

/**
 * Calcola i giorni rimanenti fino a una data
 * @param {string} isoDate - Data in formato ISO
 * @returns {number} Giorni rimanenti (negativo se passata)
 */
export const getDaysUntil = (isoDate) => {
  if (!isoDate) return Infinity;
  const targetDate = new Date(isoDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  const diffTime = targetDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

/**
 * Restituisce l'etichetta visiva dello stato veicolo.
 * Quando status='pronto' e collaudo ancora da eseguire ('da-collaudare' o
 * 'pianificato', vedi utils/collaudoUtils.isCollaudoPending) → 'Pronto ma da collaudare'.
 * Condizione duplicata qui (anziché importata) per evitare un import
 * circolare con collaudoUtils.js, che usa a sua volta fmtDMY di questo file.
 */
export const getVehicleStatusLabel = (vehicle) => {
  if (vehicle?.status === 'pronto' && (vehicle?.collaudo === 'da-collaudare' || vehicle?.collaudo === 'pianificato')) {
    return 'Pronto ma da collaudare';
  }
  const labels = {
    'da-allestire': 'Da Allestire',
    'in-allestimento': 'In Allestimento',
    'pronto': 'Pronto',
    'ritirato': 'Ritirato'
  };
  return labels[vehicle?.status] || vehicle?.status || '';
};

/**
 * Verifica se un veicolo è in scadenza (entro X giorni)
 * @param {string} dataConsegna - Data consegna in formato ISO
 * @param {number} daysThreshold - Soglia giorni (default 3)
 * @returns {boolean} True se in scadenza
 */
export const isExpiringSoon = (dataConsegna, daysThreshold = 3) => {
  const daysUntil = getDaysUntil(dataConsegna);
  return daysUntil >= 0 && daysUntil <= daysThreshold;
};
