const dataUrlToBlob = (dataUrl: string) => {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/data:(.*?);base64/)?.[1] || 'application/octet-stream';
  const binary = atob(data || '');
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mime });
};

export const openStoredFile = (dataUrl?: string, fileName = 'comprobante') => {
  if (!dataUrl) return;

  const blob = dataUrl.startsWith('data:')
    ? dataUrlToBlob(dataUrl)
    : new Blob([dataUrl], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, '_blank', 'noopener,noreferrer');

  if (!opened) {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export type StoredFile = {
  name: string;
  data: string;
};

export const parseStoredFiles = (files?: string | StoredFile[], legacyData?: string, legacyName?: string) => {
  let parsedFiles: StoredFile[] = [];

  if (Array.isArray(files)) {
    parsedFiles = files;
  } else if (typeof files === 'string' && files.trim()) {
    try {
      const parsed = JSON.parse(files);
      parsedFiles = Array.isArray(parsed) ? parsed : [];
    } catch {
      parsedFiles = [];
    }
  }

  if (legacyData && !parsedFiles.some((file) => file.data === legacyData)) {
    parsedFiles.push({ name: legacyName || 'Comprobante', data: legacyData });
  }

  return parsedFiles.filter((file) => file.data);
};
