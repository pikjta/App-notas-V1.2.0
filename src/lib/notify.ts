// Avisos del sistema. En la app de escritorio usa el plugin de notificaciones de Tauri;
// en el navegador, la API Notification.
import { isTauri } from './backend';
import { locale } from '../i18n';

export async function notificationsAllowed(ask: boolean): Promise<boolean> {
  try {
    if (isTauri()) {
      const n = await import('@tauri-apps/plugin-notification');
      if (await n.isPermissionGranted()) return true;
      return ask ? (await n.requestPermission()) === 'granted' : false;
    }
    if (typeof Notification === 'undefined') return false;
    if (Notification.permission === 'granted') return true;
    return ask ? (await Notification.requestPermission()) === 'granted' : false;
  } catch {
    return false;
  }
}

export async function notify(title: string, body: string): Promise<void> {
  try {
    if (isTauri()) {
      const n = await import('@tauri-apps/plugin-notification');
      n.sendNotification({ title, body });
    } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  } catch {
    /* sin avisos: la app sigue funcionando */
  }
}

/** Sonido suave junto al aviso (dos notas cortas). No falla si el sistema no permite audio. */
export function playChime(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [660, 880].forEach((freq, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      const t0 = ctx.currentTime + i * 0.16;
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
      o.connect(g).connect(ctx.destination); o.start(t0); o.stop(t0 + 0.55);
    });
    window.setTimeout(() => void ctx.close(), 1200);
  } catch { /* sin sonido */ }
}

let clock12 = false;
/** Lo llama la app cuando cambia el ajuste «Formato de hora». */
export const setHour12 = (v: boolean): void => { clock12 = v; };
/** Hora en el formato elegido en Ajustes (24 h o 12 h). */
export function formatClock(d: Date, hour12: boolean = clock12): string {
  return d.toLocaleTimeString(locale(), { hour: hour12 ? 'numeric' : '2-digit', minute: '2-digit', hour12 });
}
