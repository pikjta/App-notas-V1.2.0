// Medidor de fuerza de contraseña: orientativo, favorece las frases largas.
import { t } from '../i18n';

export type Strength = { level: 0 | 1 | 2 | 3; label: string };

export function strength(pw: string): Strength {
  const s = pw ?? '';
  if (s.length < 10) return { level: 0, label: t('set.strength.tooShort') };
  let score = 0;
  if (s.length >= 14) score++;
  if (s.length >= 20) score++;
  if (/[a-záéíóúñ]/.test(s) && /[A-ZÁÉÍÓÚÑ]/.test(s)) score++;
  if (/\d/.test(s)) score++;
  if (/[^A-Za-z0-9áéíóúñÁÉÍÓÚÑ]/.test(s)) score++;
  if (/^(.)\1+$/.test(s) || /(1234|abcd|qwerty|contraseña|password)/i.test(s)) score = 0;
  if (score <= 1) return { level: 1, label: t('set.strength.weak') };
  if (score <= 2) return { level: 2, label: t('set.strength.ok') };
  return { level: 3, label: t('set.strength.strong') };
}

/** Elige 3 posiciones distintas (0–23) para comprobar que el usuario apuntó sus palabras. */
export function pickChecks(): number[] {
  const out: number[] = [];
  const r = new Uint32Array(16);
  crypto.getRandomValues(r);
  for (const v of r) {
    const i = v % 24;
    if (!out.includes(i)) out.push(i);
    if (out.length === 3) break;
  }
  return out.sort((a, b) => a - b);
}
