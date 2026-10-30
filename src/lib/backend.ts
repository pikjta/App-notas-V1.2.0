// Puente con el núcleo de Rust. En la app de escritorio usa los comandos de Tauri; en un
// navegador normal (o en las pruebas) usa una versión en memoria con el mismo comportamiento.
import type { Doc } from './model';
import { t } from '../i18n';

export type Status = { encrypted: boolean; locked: boolean; docs: number; vaultCreated: number | null; quickUnlock?: boolean };
export type QuickInfo = { kind: 'touchid' | 'hello' | 'keyring'; available: boolean; enabled: boolean };
export type UpdateInfo = { version: string; notes: string; date: string | null };
export type SnapshotInfo = { id: number; at: number; docs: number };
export type BackupInfo = { encrypted: boolean; docs: number; exportedAt: number };

export interface Backend {
  readonly kind: 'tauri' | 'memory';
  status(): Promise<Status>;
  all(): Promise<Doc[]>;
  put(docs: Doc[]): Promise<void>;
  remove(ids: string[]): Promise<void>;
  vaultPrepare(password: string): Promise<string[]>;
  vaultConfirm(checks: [number, string][]): Promise<void>;
  vaultCancel(): Promise<void>;
  lock(): Promise<void>;
  unlock(password: string): Promise<void>;
  recover(words: string, newPassword: string): Promise<void>;
  changePassword(current: string, next: string): Promise<void>;
  rotateWords(current: string): Promise<string[]>;
  disable(current: string): Promise<void>;
  backupExport(path: string): Promise<void>;
  backupInspect(path: string): Promise<BackupInfo>;
  backupImport(path: string, secret: string | null, words: boolean): Promise<number>;
  pickSavePath(defaultName: string): Promise<string | null>;
  pickOpenPath(): Promise<string | null>;
  /** Elegir una carpeta (para las copias automáticas). */
  pickFolder(): Promise<string | null>;
  /** Escribe una copia automática en la carpeta y devuelve el nombre del archivo. */
  autoBackup(dir: string, stamp: string, keep: number): Promise<string>;
  autoBackupList(dir: string): Promise<string[]>;
  /** Carpeta Descargas del sistema (carpeta de backup por defecto). */
  downloadsDir(): Promise<string>;
  /** Abre un enlace http, https o mailto en el navegador del sistema. */
  openUrl(url: string): Promise<void>;
  /** Copia manual en `<carpeta>/backup manual`. Devuelve el nombre del archivo. */
  manualBackup(dir: string, stamp: string): Promise<string>;
  /** Copias internas: viven dentro de la propia base de datos. */
  /** Archivo de la copia interna en `<carpeta>/backup interno`. */
  internalFile(dir: string, stamp: string, keep: number): Promise<string>;
  snapshotCreate(keep: number): Promise<SnapshotInfo>;
  snapshotList(): Promise<SnapshotInfo[]>;
  snapshotRestore(id: number, keep: number): Promise<number>;
  /** Desbloqueo rápido con el llavero del sistema (Touch ID / Windows Hello / llavero de sesión). */
  quickInfo(): Promise<QuickInfo>;
  quickEnable(): Promise<void>;
  quickDisable(): Promise<void>;
  quickUnlock(): Promise<void>;
  /** Actualizaciones firmadas. */
  appVersion(): Promise<string>;
  checkUpdate(): Promise<UpdateInfo | null>;
  installUpdate(onProgress: (pct: number | null) => void): Promise<void>;
  /** Guarda un .ics (pide la ruta al usuario). Devuelve false si cancela. */
  saveIcs(defaultName: string, text: string): Promise<boolean>;
  /** Pide un .ics al usuario y devuelve su nombre y contenido, o null si cancela. */
  openIcs(): Promise<{ name: string; text: string } | null>;
  saveCsv(defaultName: string, text: string): Promise<boolean>;
  openCsv(): Promise<{ name: string; text: string } | null>;
}

export const isTauri = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Los errores del núcleo llegan como texto ya redactado para el usuario. */
export function errorText(e: unknown): string {
  if (typeof e === 'string') return e;
  if (e instanceof Error) return e.message;
  return t('set.backend.fail');
}

// Actualización encontrada en la última comprobación (se instala con installUpdate).
let pendingUpdate: import('@tauri-apps/plugin-updater').Update | null = null;

export async function tauriBackend(): Promise<Backend> {
  const { invoke } = await import('@tauri-apps/api/core');
  const dialog = await import('@tauri-apps/plugin-dialog');
  const filters = [{ name: t('set.backend.filterBackup'), extensions: ['json'] }];
  return {
    kind: 'tauri',
    status: () => invoke('app_status'),
    all: () => invoke('docs_all'),
    put: (docs) => invoke('docs_put', { docs }),
    remove: (ids) => invoke('docs_delete', { ids }),
    vaultPrepare: (password) => invoke('vault_prepare', { password }),
    vaultConfirm: (checks) => invoke('vault_confirm', { checks }),
    vaultCancel: () => invoke('vault_cancel'),
    lock: () => invoke('vault_lock'),
    unlock: (password) => invoke('vault_unlock', { password }),
    recover: (words, newPassword) => invoke('vault_recover', { words, newPassword }),
    changePassword: (current, next) => invoke('vault_change_password', { current, next }),
    rotateWords: (current) => invoke('vault_rotate_words', { current }),
    disable: (current) => invoke('vault_disable', { current }),
    backupExport: (path) => invoke('backup_export', { path }),
    backupInspect: (path) => invoke('backup_inspect', { path }),
    backupImport: (path, secret, words) => invoke('backup_import', { path, secret, words }),
    pickSavePath: async (defaultName) => (await dialog.save({ defaultPath: defaultName, filters })) ?? null,
    pickOpenPath: async () => {
      const r = await dialog.open({ multiple: false, directory: false, filters });
      return typeof r === 'string' ? r : null;
    },
    saveIcs: async (defaultName, text) => {
      const path = await dialog.save({ defaultPath: defaultName, filters: [{ name: t('set.backend.filterCalendar'), extensions: ['ics'] }] });
      if (!path) return false;
      await invoke('ics_write', { path, text });
      return true;
    },
    pickFolder: async () => { const r = await dialog.open({ directory: true, multiple: false }); return typeof r === 'string' ? r : null; },
    autoBackup: (dir, stamp, keep) => invoke('auto_backup', { dir, stamp, keep }),
    autoBackupList: (dir) => invoke('auto_backup_list', { dir }),
    downloadsDir: () => invoke('downloads_dir'),
    openUrl: (url) => invoke('open_url', { url }),
    manualBackup: (dir, stamp) => invoke('manual_backup', { dir, stamp }),
    internalFile: (dir, stamp, keep) => invoke('internal_backup_file', { dir, stamp, keep }),
    snapshotCreate: (keep) => invoke('snapshot_create', { keep }),
    snapshotList: () => invoke('snapshot_list'),
    snapshotRestore: (id, keep) => invoke('snapshot_restore', { id, keep }),
    quickInfo: () => invoke('quick_unlock_info'),
    quickEnable: () => invoke('quick_unlock_enable'),
    quickDisable: () => invoke('quick_unlock_disable'),
    quickUnlock: () => invoke('quick_unlock'),
    appVersion: async () => (await import('@tauri-apps/api/app')).getVersion(),
    checkUpdate: async () => {
      const { check } = await import('@tauri-apps/plugin-updater');
      const u = await check();
      pendingUpdate = u;
      return u ? { version: u.version, notes: u.body ?? '', date: u.date ?? null } : null;
    },
    installUpdate: async (onProgress) => {
      if (!pendingUpdate) throw t('set.backend.noUpdate');
      let total = 0, got = 0;
      await pendingUpdate.downloadAndInstall((ev) => {
        if (ev.event === 'Started') { total = ev.data.contentLength ?? 0; onProgress(total ? 0 : null); }
        else if (ev.event === 'Progress') { got += ev.data.chunkLength; onProgress(total ? Math.round((got / total) * 100) : null); }
        else if (ev.event === 'Finished') onProgress(100);
      });
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    },
    saveCsv: async (defaultName, text) => {
      const path = await dialog.save({ defaultPath: defaultName, filters: [{ name: 'CSV', extensions: ['csv'] }] });
      if (!path) return false;
      await invoke('csv_write', { path, text });
      return true;
    },
    openCsv: async () => {
      const r = await dialog.open({ multiple: false, directory: false, filters: [{ name: 'CSV', extensions: ['csv'] }] });
      if (typeof r !== 'string') return null;
      return { name: r.split(/[\\/]/).pop() ?? 'tabla.csv', text: await invoke<string>('csv_read', { path: r }) };
    },
    openIcs: async () => {
      const r = await dialog.open({ multiple: false, directory: false, filters: [{ name: t('set.backend.filterCalendar'), extensions: ['ics'] }] });
      if (typeof r !== 'string') return null;
      return { name: r.split(/[\\/]/).pop() ?? 'calendario.ics', text: await invoke<string>('ics_read', { path: r }) };
    },
  };
}

/**
 * Versión en memoria para desarrollar la interfaz en el navegador y para las pruebas.
 * Imita las reglas del núcleo (bloqueo, contraseña mínima, confirmación de palabras),
 * pero NO cifra: nunca se usa en la app de escritorio.
 */
export function memoryBackend(initial: Doc[] = []): Backend {
  let docs = new Map(initial.map((d) => [d.id, d]));
  let pw: string | null = null;
  let snapSeq = 0;
  const snaps: { info: SnapshotInfo; docs: Doc[] }[] = [];
  let words: string[] | null = null;
  let pending: { pw: string; words: string[] } | null = null;
  let locked = false;
  let quick = false;
  const files = new Map<string, string>();
  const need = () => {
    if (locked) throw t('set.backend.locked');
  };
  const sample = (rev = false) => {
    const base = ['ábaco', 'abeja', 'mural', 'pincel', 'barniz', 'paleta', 'sierra', 'aurora'];
    const w = Array.from({ length: 24 }, (_, i) => base[i % base.length]);
    return rev ? w.reverse() : w;
  };
  const strip = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  return {
    kind: 'memory',
    status: async () => ({ encrypted: pw !== null, locked, docs: docs.size, vaultCreated: pw ? Date.now() : null, quickUnlock: quick }),
    all: async () => (need(), [...docs.values()]),
    put: async (ds) => { need(); ds.forEach((d) => docs.set(d.id, d)); },
    remove: async (ids) => { need(); ids.forEach((id) => docs.delete(id)); },
    vaultPrepare: async (p) => {
      if (p.length < 10) throw t('set.password.minLength');
      pending = { pw: p, words: sample() };
      return pending.words;
    },
    vaultConfirm: async (checks) => {
      if (!pending) throw t('set.backend.noPending');
      for (const [i, w] of checks) if (strip(pending.words[i]) !== strip(w)) throw t('set.backend.invalidWords', { n: i + 1 });
      pw = pending.pw; words = pending.words; pending = null;
    },
    vaultCancel: async () => { pending = null; },
    lock: async () => { if (pw) locked = true; },
    unlock: async (p) => { if (p !== pw) throw t('set.password.wrong'); locked = false; },
    recover: async (w, np) => {
      if (strip(w).split(/\s+/).join(' ') !== strip((words ?? []).join(' '))) throw t('set.backend.wrongWords');
      if (np.length < 10) throw t('set.password.minLength');
      pw = np; locked = false;
    },
    changePassword: async (c, n) => {
      if (c !== pw) throw t('set.password.wrong');
      if (n.length < 10) throw t('set.password.minLength');
      pw = n;
    },
    rotateWords: async (c) => { if (c !== pw) throw t('set.password.wrong'); words = sample(true); return words; },
    disable: async (c) => { if (c !== pw) throw t('set.password.wrong'); pw = null; words = null; quick = false; },
    backupExport: async (path) => { need(); files.set(path, JSON.stringify([...docs.values()])); },
    backupInspect: async (path) => {
      const f = files.get(path);
      if (!f) throw t('set.backend.notBackupFile');
      return { encrypted: false, docs: (JSON.parse(f) as Doc[]).length, exportedAt: Date.now() };
    },
    backupImport: async (path) => {
      need();
      const f = files.get(path);
      if (!f) throw t('set.backend.notBackupFile');
      const list = JSON.parse(f) as Doc[];
      docs = new Map(list.map((d) => [d.id, d]));
      return list.length;
    },
    pickSavePath: async (n) => n,
    pickOpenPath: async () => [...files.keys()].pop() ?? null,
    // En el navegador: descarga el archivo y lo recuerda para poder «abrirlo» en las pruebas.
    saveIcs: async (n, text) => {
      files.set(n, text);
      try {
        const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar' }));
        const a = document.createElement('a'); a.href = url; a.download = n; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } catch { /* sin descarga en las pruebas */ }
      return true;
    },
    openIcs: async () => {
      const n = [...files.keys()].filter((k) => k.endsWith('.ics')).pop();
      return n ? { name: n, text: files.get(n)! } : null;
    },
    pickFolder: async () => '/carpeta/de/prueba',
    autoBackup: async (dir, stamp, keep) => {
      need();
      const name = `cuaderno_auto_${stamp}${pw ? '_cifrado' : ''}.json`;
      const sub = dir + '/backup automático/';
      files.set(sub + name, JSON.stringify([...docs.values()]));
      const mine = [...files.keys()].filter((k) => k.startsWith(sub + 'cuaderno_auto_')).sort().reverse();
      mine.slice(Math.max(1, keep)).forEach((k) => files.delete(k));
      return name;
    },
    quickInfo: async () => ({ kind: 'keyring', available: true, enabled: quick }),
    quickEnable: async () => { need(); if (!pw) throw t('set.backend.encryptionOff'); quick = true; },
    quickDisable: async () => { quick = false; },
    quickUnlock: async () => { if (!quick) throw t('set.backend.quickOff'); locked = false; },
    appVersion: async () => t('set.backend.browserVersion'),
    checkUpdate: async () => null,
    installUpdate: async () => { throw t('set.backend.desktopOnly'); },
    autoBackupList: async (dir) => { const sub = dir + '/backup automático/'; return [...files.keys()].filter((k) => k.startsWith(sub + 'cuaderno_auto_')).map((k) => k.slice(sub.length)).sort().reverse(); },
    downloadsDir: async () => '/Descargas',
    openUrl: async (url) => { if (/^(https?:|mailto:)/i.test(url) && typeof window !== 'undefined' && typeof window.open === 'function') try { window.open(url, '_blank', 'noopener'); } catch { /* sin navegador */ } },
    manualBackup: async (dir, stamp) => {
      need();
      const name = `cuaderno_manual_${stamp}${pw ? '_cifrado' : ''}.json`;
      files.set(dir + '/backup manual/' + name, JSON.stringify([...docs.values()]));
      return name;
    },
    internalFile: async (dir, stamp, keep) => {
      need();
      const name = `cuaderno_interno_${stamp}${pw ? '_cifrado' : ''}.json`;
      const sub = dir + '/backup interno/';
      files.set(sub + name, JSON.stringify([...docs.values()]));
      [...files.keys()].filter((k) => k.startsWith(sub + 'cuaderno_interno_')).sort().reverse().slice(Math.max(1, keep)).forEach((k) => files.delete(k));
      return name;
    },
    snapshotCreate: async (keep) => {
      need();
      const info = { id: ++snapSeq, at: Date.now(), docs: docs.size };
      snaps.unshift({ info, docs: [...docs.values()].map((d) => ({ ...d })) });
      snaps.splice(Math.max(1, keep));
      return info;
    },
    snapshotList: async () => { need(); return snaps.map((x) => x.info); },
    snapshotRestore: async (id, keep) => {
      need();
      const snap = snaps.find((x) => x.info.id === id);
      if (!snap) throw t('set.backend.noSnapshot');
      snaps.unshift({ info: { id: ++snapSeq, at: Date.now(), docs: docs.size }, docs: [...docs.values()].map((d) => ({ ...d })) });
      snaps.splice(Math.max(1, keep));
      docs = new Map(snap.docs.map((d) => [d.id, d]));
      return snap.docs.length;
    },
    saveCsv: async (n, text) => {
      files.set(n, text);
      try {
        const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
        const a = document.createElement('a'); a.href = url; a.download = n; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      } catch { /* sin descarga en las pruebas */ }
      return true;
    },
    openCsv: async () => {
      const n = [...files.keys()].filter((k) => k.endsWith('.csv')).pop();
      return n ? { name: n, text: files.get(n)! } : null;
    },
  };
}
