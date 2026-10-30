// Importar y exportar calendarios en formato iCalendar (.ics, RFC 5545): el que usan Google
// Calendar, Apple Calendar y Outlook. Solo lo esencial: eventos con título, fechas y notas.

import { t } from '../i18n';

export type IcsEvent = { uid: string; title: string; start: string; end: string; allDay: boolean; note: string };

const pad = (n: number) => String(n).padStart(2, '0');

const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const unesc = (t: string) => t.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');

/** Las líneas de más de 75 octetos se parten y continúan con un espacio. */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  let len = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (len + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; len = 0; }
    cur += ch; len += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const utc = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
};
const dateOnly = (iso: string) => iso.slice(0, 10).replace(/-/g, '');

/**
 * Genera un archivo .ics. Las fechas de día completo van como DATE (fin exclusivo, como manda
 * el estándar); las demás, en UTC.
 */
export function toIcs(name: string, events: IcsEvent[], now = new Date()): string {
  const stamp = utc(now.toISOString());
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Cuaderno//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + esc(name)];
  for (const e of events) {
    lines.push('BEGIN:VEVENT', 'UID:' + e.uid, 'DTSTAMP:' + stamp);
    if (e.allDay) {
      const endEx = new Date(e.end.slice(0, 10) + 'T00:00:00');
      endEx.setDate(endEx.getDate() + 1);
      lines.push('DTSTART;VALUE=DATE:' + dateOnly(e.start), 'DTEND;VALUE=DATE:' + `${endEx.getFullYear()}${pad(endEx.getMonth() + 1)}${pad(endEx.getDate())}`);
    } else {
      lines.push('DTSTART:' + utc(e.start), 'DTEND:' + utc(e.end));
    }
    lines.push('SUMMARY:' + esc(e.title || t('cal.untitled')));
    if (e.note) lines.push('DESCRIPTION:' + esc(e.note));
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Interpreta una fecha iCalendar. Con zona horaria (TZID) se toma como hora local. */
function parseDate(value: string, params: string): { iso: string; allDay: boolean } | null {
  const v = value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (!h || /VALUE=DATE(?!-TIME)/i.test(params)) return { iso: `${y}-${mo}-${d}`, allDay: true };
  const date = z ? new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0))) : new Date(+y, +mo - 1, +d, +h, +mi, +(s ?? 0));
  return { iso: date.toISOString(), allDay: false };
}

/** Duración ISO sencilla (P1D, PT1H30M, P1W) en milisegundos. */
function duration(v: string): number {
  const m = v.match(/^P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const [, w, d, h, mi, s] = m.map((x) => (x ? +x : 0));
  return ((((w * 7 + d) * 24 + h) * 60 + mi) * 60 + s) * 1000;
}

export type IcsImport = { name: string | null; events: IcsEvent[]; skipped: number; repeating: number };

export function parseIcs(text: string): IcsImport {
  // Desplegar líneas partidas (las que empiezan por espacio o tabulador continúan la anterior).
  const lines = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  let name: string | null = null;
  const events: IcsEvent[] = [];
  let cur: Record<string, { value: string; params: string }> | null = null;
  let skipped = 0, repeating = 0, n = 0;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT' && cur) {
      const s = cur.DTSTART && parseDate(cur.DTSTART.value, cur.DTSTART.params);
      if (!s) { skipped++; cur = null; continue; }
      if (cur.RRULE) repeating++;
      let end: string;
      if (cur.DTEND && parseDate(cur.DTEND.value, cur.DTEND.params)) {
        end = parseDate(cur.DTEND.value, cur.DTEND.params)!.iso;
        if (s.allDay) { const d = new Date(end + 'T00:00:00'); d.setDate(d.getDate() - 1); end = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; if (end < s.iso) end = s.iso; }
      } else if (cur.DURATION) {
        end = s.allDay ? s.iso : new Date(new Date(s.iso).getTime() + duration(cur.DURATION.value)).toISOString();
      } else {
        end = s.allDay ? s.iso : new Date(new Date(s.iso).getTime() + 3_600_000).toISOString();
      }
      events.push({ uid: cur.UID?.value || `import-${++n}`, title: unesc(cur.SUMMARY?.value ?? t('cal.untitled')), start: s.iso, end, allDay: s.allDay, note: unesc(cur.DESCRIPTION?.value ?? '') });
      cur = null;
      continue;
    }
    const i = line.indexOf(':');
    if (i < 0) continue;
    const head = line.slice(0, i);
    const value = line.slice(i + 1);
    const [prop, ...params] = head.split(';');
    if (!cur && prop.toUpperCase() === 'X-WR-CALNAME') name = unesc(value);
    if (cur) cur[prop.toUpperCase()] = { value, params: params.join(';') };
  }
  return { name, events, skipped, repeating };
}
