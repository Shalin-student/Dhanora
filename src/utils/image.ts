export interface ProcessedReceipt {
  fileName: string;
  mimeType: string;
  dataUrl: string;
  sizeBytes: number;
}

export function estimateDataUrlBytes(dataUrl: string): number {
  const base64Part = dataUrl.split(',')[1] ?? '';
  if (!base64Part) return dataUrl.length;
  const padding = base64Part.endsWith('==') ? 2 : base64Part.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64Part.length * 3) / 4) - padding);
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Reads an uploaded receipt file and compresses oversized raster images
 * client-side (max 1400px edge, JPEG quality 0.82) for fast IndexedDB storage.
 */
export async function processReceiptFile(file: File, maxDimension = 1400): Promise<ProcessedReceipt> {
  const rawDataUrl = await readFileAsDataUrl(file);
  const isCompressibleImage =
    file.type.startsWith('image/') && file.type !== 'image/svg+xml' && file.type !== 'image/gif';

  if (!isCompressibleImage || typeof document === 'undefined' || typeof Image === 'undefined') {
    return {
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      dataUrl: rawDataUrl,
      sizeBytes: estimateDataUrlBytes(rawDataUrl),
    };
  }

  try {
    const compressedUrl = await new Promise<string>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width || 1, img.height || 1));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const out = canvas.toDataURL('image/jpeg', 0.82);
        resolve(out.length < rawDataUrl.length ? out : rawDataUrl);
      };
      img.onerror = () => resolve(rawDataUrl);
      img.src = rawDataUrl;
    });

    const outMime = compressedUrl.startsWith('data:image/jpeg')
      ? 'image/jpeg'
      : file.type || 'image/png';
    return {
      fileName: file.name,
      mimeType: outMime,
      dataUrl: compressedUrl,
      sizeBytes: estimateDataUrlBytes(compressedUrl),
    };
  } catch {
    return {
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      dataUrl: rawDataUrl,
      sizeBytes: estimateDataUrlBytes(rawDataUrl),
    };
  }
}
