export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain', 'text/csv',
];
export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export function validateFile(file, showToast) {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    showToast(`Tipo file non consentito: ${file.name}. Sono permessi PDF, immagini, documenti Office e testi.`, 'error');
    return false;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    showToast(`Il file "${file.name}" supera il limite di ${MAX_FILE_SIZE_MB}MB.`, 'error');
    return false;
  }
  return true;
}
