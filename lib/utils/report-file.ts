export function isPdfReportFile(fileName?: string, mimeType?: string) {
  const normalizedName = fileName?.trim().toLowerCase() || '';
  const normalizedMime = mimeType?.trim().toLowerCase() || '';

  return normalizedName.endsWith('.pdf') || normalizedMime === 'application/pdf';
}

function looksLikePdfUrl(fileUrl: string) {
  return fileUrl.toLowerCase().includes('.pdf');
}

export function getReportUploadResourceType(file: File) {
  return isPdfReportFile(file.name, file.type) ? 'raw' : 'image';
}

export function normalizeReportFileUrl(fileUrl?: string, fileName?: string) {
  if (!fileUrl) return '';

  const normalizedUrl = fileUrl.trim();
  if (!normalizedUrl) return '';

  if (!isPdfReportFile(fileName, undefined) && !looksLikePdfUrl(normalizedUrl)) {
    return normalizedUrl;
  }

  return normalizedUrl.replace('/image/upload/', '/raw/upload/');
}