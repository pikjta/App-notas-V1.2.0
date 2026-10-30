// Lectura de imágenes en el navegador: reduce a un tamaño razonable y extrae colores.
import { paletteFromPixels } from './graphics';
import { t } from '../i18n';

const MAX_SIDE = 1600;

/** Lee un archivo de imagen y lo devuelve como data URL, reducido a 1600 px de lado como máximo. */
export function readImage(file: File): Promise<{ mime: string; data: string }> {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) { reject(t('card.img.notImage')); return; }
    const rd = new FileReader();
    rd.onerror = () => reject(t('card.img.readFail'));
    rd.onload = () => {
      const raw = String(rd.result);
      if (file.type === 'image/svg+xml' || file.type === 'image/gif') { resolve({ mime: file.type, data: raw }); return; }
      const img = new Image();
      img.onload = () => {
        try {
          const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
          if (k === 1 && file.size < 1_500_000) { resolve({ mime: file.type, data: raw }); return; }
          const cv = document.createElement('canvas');
          cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
          cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
          const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          resolve({ mime, data: cv.toDataURL(mime, 0.88) });
        } catch { resolve({ mime: file.type, data: raw }); }
      };
      img.onerror = () => resolve({ mime: file.type, data: raw });
      img.src = raw;
    };
    rd.readAsDataURL(file);
  });
}

/** Colores principales de una imagen (data URL). */
export function extractPalette(dataUrl: string, max = 8): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const k = Math.min(1, 120 / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(img.width * k)); cv.height = Math.max(1, Math.round(img.height * k));
        const ctx = cv.getContext('2d')!;
        ctx.drawImage(img, 0, 0, cv.width, cv.height);
        resolve(paletteFromPixels(ctx.getImageData(0, 0, cv.width, cv.height).data, max));
      } catch { reject(t('card.img.colorsFail')); }
    };
    img.onerror = () => reject(t('card.img.openFail'));
    img.src = dataUrl;
  });
}
