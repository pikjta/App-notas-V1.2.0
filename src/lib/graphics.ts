// Utilidades gráficas puras (sin DOM): trazos de boceto, paletas de color y flechas.
import type { Stroke } from './model';

/** Trazo suavizado con curvas cuadráticas entre puntos medios. */
export function strokePath(p: [number, number][]): string {
  if (!p.length) return '';
  if (p.length === 1) return `M ${p[0][0]} ${p[0][1]} l 0.1 0.1`;
  let d = `M ${p[0][0]} ${p[0][1]}`;
  for (let i = 1; i < p.length - 1; i++) {
    const mx = ((p[i][0] + p[i + 1][0]) / 2).toFixed(1), my = ((p[i][1] + p[i + 1][1]) / 2).toFixed(1);
    d += ` Q ${p[i][0]} ${p[i][1]} ${mx} ${my}`;
  }
  const L = p[p.length - 1];
  return d + ` L ${L[0]} ${L[1]}`;
}

/** Trazos que siguen en pie después de pasar el borrador por el punto `q`. */
export function eraseAt(strokes: Stroke[], q: [number, number]): Stroke[] {
  return strokes.filter((st) => !st.p.some((pt) => Math.hypot(pt[0] - q[0], pt[1] - q[1]) < 8 + st.s / 2));
}

/**
 * Colores principales de una imagen a partir de sus píxeles RGBA: agrupa colores parecidos,
 * favorece los más frecuentes y saturados, y elige `max` que se distingan bien entre sí.
 */
export function paletteFromPixels(data: ArrayLike<number>, max = 8): string[] {
  const buckets = new Map<string, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const k = `${r >> 3},${g >> 3},${b >> 3}`;
    const B = buckets.get(k) ?? { n: 0, r: 0, g: 0, b: 0 };
    B.n++; B.r += r; B.g += g; B.b += b;
    buckets.set(k, B);
  }
  const list = [...buckets.values()].map((B) => {
    const c = { n: B.n, r: B.r / B.n, g: B.g / B.n, b: B.b / B.n };
    const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b);
    return { ...c, score: c.n * (0.6 + (mx ? (mx - mn) / mx : 0)) };
  }).sort((a, b) => b.score - a.score);
  const dist = (a: typeof list[0], b: typeof list[0]) => Math.sqrt(2 * (a.r - b.r) ** 2 + 4 * (a.g - b.g) ** 2 + 3 * (a.b - b.b) ** 2);
  const out: typeof list = [];
  for (let t = 90; t >= 30 && out.length < max; t -= 20) for (const x of list) if (out.length < max && out.every((y) => dist(x, y) > t)) out.push(x);
  const lum = (x: typeof list[0]) => 0.2126 * x.r + 0.7152 * x.g + 0.0722 * x.b;
  return out.sort((a, b) => lum(b) - lum(a)).map((x) => '#' + [x.r, x.g, x.b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase());
}

export function formatColor(hex: string, fmt: 'hex' | 'rgb' | 'hsl'): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  if (fmt === 'rgb') return `rgb(${r}, ${g}, ${b})`;
  if (fmt === 'hsl') {
    const R = r / 255, G = g / 255, B = b / 255;
    const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
    const L = (mx + mn) / 2;
    let H = 0, S = 0;
    if (mx !== mn) {
      const d = mx - mn;
      S = L > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      H = (mx === R ? (G - B) / d + (G < B ? 6 : 0) : mx === G ? (B - R) / d + 2 : (R - G) / d + 4) * 60;
    }
    return `hsl(${Math.round(H)}, ${Math.round(S * 100)}%, ${Math.round(L * 100)}%)`;
  }
  return '#' + h.toUpperCase();
}

/** ¿Texto oscuro o claro sobre este fondo? */
export function inkOn(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const L = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255;
  return L > 0.55 ? '#1F1D1A' : '#FFFFFF';
}

export type Rect = { x: number; y: number; w: number; h: number };

/**
 * Flecha curva entre dos tarjetas: sale del lado más cercano de cada una.
 * Devuelve el trazo, la punta y el punto medio (para la etiqueta).
 */
export function arrowBetween(A: Rect, B: Rect) {
  const acx = A.x + A.w / 2, acy = A.y + A.h / 2, bcx = B.x + B.w / 2, bcy = B.y + B.h / 2;
  const dx = bcx - acx, dy = bcy - acy;
  let x1: number, y1: number, x2: number, y2: number, d1: [number, number], d2: [number, number];
  if (Math.abs(dx) * (A.h + B.h) >= Math.abs(dy) * (A.w + B.w)) {
    const s = dx >= 0 ? 1 : -1;
    x1 = s > 0 ? A.x + A.w : A.x; y1 = acy; x2 = s > 0 ? B.x : B.x + B.w; y2 = bcy; d1 = [s, 0]; d2 = [-s, 0];
  } else {
    const s = dy >= 0 ? 1 : -1;
    x1 = acx; y1 = s > 0 ? A.y + A.h : A.y; x2 = bcx; y2 = s > 0 ? B.y : B.y + B.h; d1 = [0, s]; d2 = [0, -s];
  }
  const k = Math.max(40, Math.hypot(x2 - x1, y2 - y1) / 3);
  const c1: [number, number] = [x1 + d1[0] * k, y1 + d1[1] * k], c2: [number, number] = [x2 + d2[0] * k, y2 + d2[1] * k];
  const head = (tx: number, ty: number, fx: number, fy: number) => {
    const a = Math.atan2(ty - fy, tx - fx);
    const p = (ang: number) => `${(tx + 10 * Math.cos(ang)).toFixed(1)} ${(ty + 10 * Math.sin(ang)).toFixed(1)}`;
    return `M ${p(a + Math.PI * 0.85)} L ${tx.toFixed(1)} ${ty.toFixed(1)} L ${p(a - Math.PI * 0.85)}`;
  };
  return {
    d: `M ${x1} ${y1} C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${x2} ${y2}`,
    headTo: head(x2, y2, c2[0], c2[1]),
    headFrom: head(x1, y1, c1[0], c1[1]),
    mid: { x: 0.125 * x1 + 0.375 * c1[0] + 0.375 * c2[0] + 0.125 * x2, y: 0.125 * y1 + 0.375 * c1[1] + 0.375 * c2[1] + 0.125 * y2 },
  };
}
