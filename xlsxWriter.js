import ExcelJS from 'exceljs';

/**
 * Scrittura XLSX centralizzata (via `exceljs`, non `xlsx`/SheetJS: la build
 * community di SheetJS non scrive stili sulle celle, quindi grassetto/sfondo
 * sull'intestazione non comparivano nel file anche se il codice li impostava).
 */

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDD7EE' } };

function styleHeaderRow(sheet) {
  sheet.getRow(1).eachCell(cell => {
    cell.font = { bold: true };
    cell.fill = HEADER_FILL;
  });
}

/**
 * Aggiunge un foglio con intestazione formattata (grassetto + sfondo,
 * larghezza colonna in base al testo del titolo) a un workbook.
 * @param {ExcelJS.Workbook} workbook
 * @param {string} sheetName
 * @param {string[]} labels - titoli colonna, nell'ordine desiderato
 * @param {Array<Array<string>>} rows - valori riga, stesso ordine di `labels`
 */
export function addSheet(workbook, sheetName, labels, rows) {
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = labels.map(label => ({ header: label, width: Math.max(label.length + 2, 14) }));
  rows.forEach(row => sheet.addRow(row));
  styleHeaderRow(sheet);
  return sheet;
}

/** Avvia il download del workbook nel browser. */
export async function downloadWorkbook(workbook, filename) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Serializza il workbook in un Uint8Array (per File System Access API). */
export async function workbookToUint8Array(workbook) {
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

export { ExcelJS };
