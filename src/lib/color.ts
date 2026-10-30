// Conversión de colores para el selector libre (HEX, RGB y HSB).

export type Rgb = [number, number, number];
export type Hsb = [number, number, number]; // h 0–360, s 0–100, b 0–100

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/** «#abc», «abc», «#aabbcc» o «aabbcc» → «#AABBCC»; null si no es un color. */
export function normalizeHex(text: string): string | null {
  const h = text.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(h)) return '#' + h.split('').map((c) => c + c).join('').toUpperCase();
  if (/^[0-9a-fA-F]{6}$/.test(h)) return '#' + h.toUpperCase();
  return null;
}

export function hexToRgb(hex: string): Rgb {
  const n = parseInt((normalizeHex(hex) ?? '#000000').slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  return '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function rgbToHsb([r, g, b]: Rgb): Hsb {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B), d = max - min;
  let h = 0;
  if (d) {
    if (max === R) h = ((G - B) / d) % 6;
    else if (max === G) h = (B - R) / d + 2;
    else h = (R - G) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [Math.round(h), Math.round(max ? (d / max) * 100 : 0), Math.round(max * 100)];
}

export function hsbToRgb([h, s, v]: Hsb): Rgb {
  const S = clamp(s, 0, 100) / 100, V = clamp(v, 0, 100) / 100, H = ((h % 360) + 360) % 360;
  const c = V * S, x = c * (1 - Math.abs(((H / 60) % 2) - 1)), m = V - c;
  const [r, g, b] = H < 60 ? [c, x, 0] : H < 120 ? [x, c, 0] : H < 180 ? [0, c, x] : H < 240 ? [0, x, c] : H < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export const hexToHsb = (hex: string): Hsb => rgbToHsb(hexToRgb(hex));
export const hsbToHex = (hsb: Hsb): string => rgbToHex(hsbToRgb(hsb));
