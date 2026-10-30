import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Backend, Status } from './lib/backend';
import { errorText, isTauri, memoryBackend, tauriBackend } from './lib/backend';
import { everyMs, fromDocs, starterDocs } from './lib/model';
import { sampleDocs } from './lib/sample';
import { detectLang, rememberLang, setLang, startupLang, t } from './i18n';
import { coalesceKey, createSaver, diff, emptyState, History, NO_HISTORY, reduce, snapOf, VIEW_ONLY } from './lib/store';
import { dueNotifications } from './lib/agenda';
import { notificationsAllowed, notify, playChime, setHour12 } from './lib/notify';
import type { Action, State } from './lib/store';
import type { LinkResolver } from './lib/markdown';

export type LinkTarget = { dest: string; label: string; kind: string; color: string };
const fold = (t: string) => t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
import { Sidebar } from './components/Sidebar';
import { Board } from './components/Board';
import { Search } from './components/Search';
import { Trash } from './components/Trash';
import { Journal } from './views/Journal';
import { CalendarView } from './views/Calendar';
import { Graph } from './views/Graph';
import { PmTable } from './views/PmTable';
import { rowTitle, setWorld } from './lib/pm';
import type { WorldCard } from './lib/pm';
import { Reminders } from './views/Reminders';
import { Today } from './views/Today';
import { LockScreen } from './screens/LockScreen';
import { Settings } from './screens/Settings';
import type { SettingsTab } from './screens/Settings';

type Ctx = {
  state: State;
  dispatch: (a: Action) => void;
  backend: Backend;
  status: Status;
  refreshStatus: () => Promise<void>;
  lock: () => Promise<void>;
  reload: () => Promise<void>;
  toast: (msg: string) => void;
  openSettings: (tab?: SettingsTab) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  openSearch: () => void;
  goTo: (project: string, card: string | null) => void;
  flashId: string | null;
  resolveLink: LinkResolver;
  linkTargets: (query: string) => LinkTarget[];
  canBack: boolean;
  goBack: () => void;
  copy: (text: string, okMsg: string) => void;
  /** Pide que una nota se abra en modo edición en cuanto aparezca (p. ej. al crear la del día). */
  editRequest: string | null;
  requestEdit: (id: string | null) => void;
  /** Evento que la vista Calendario debe abrir para editar (desde la búsqueda, por ejemplo). */
  editEvent: string | null;
  setEditEvent: (id: string | null) => void;
  openEvent: (id: string) => void;
  /** Abre una Tabla PM en grande. */
  openPm: (cardId: string, rowId?: string) => void;
  /** Hacer ahora una copia automática en la carpeta configurada. */
  backupNow: () => Promise<void>;
  snapshotNow: () => Promise<void>;
};

const AppCtx = createContext<Ctx | null>(null);
export const useApp = (): Ctx => {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp fuera de <App>');
  return c;
};

export default function App() {
  const [backend, setBackend] = useState<Backend | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [state, setState] = useState<State>(emptyState);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [backStack, setBackStack] = useState<string[]>([]);
  const [editEvent, setEditEvent] = useState<string | null>(null);
  const [pmOpen, setPmOpen] = useState<string | null>(null);
  const [pmRowOpen, setPmRowOpen] = useState<string | null>(null);
  const [editRequest, setEditRequest] = useState<string | null>(null);
  const [, bump] = useState(0);
  const stateRef = useRef(state);
  stateRef.current = state;
  const history = useRef(new History());

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg((m) => (m === msg ? null : m)), 3200);
  }, []);

  // Enlaces normales [texto](url): se abren en el navegador del sistema.
  useEffect(() => {
    const h = (e: Event) => { const url = String((e as CustomEvent).detail ?? ''); backend?.openUrl(url).catch(() => toast(t('ui.app.openLinkFail'))); };
    window.addEventListener('cuaderno:open-url', h);
    return () => window.removeEventListener('cuaderno:open-url', h);
  }, [backend, toast]);
  const saver = useMemo(() => (backend ? createSaver(backend, toast) : null), [backend, toast]);

  const dispatch = useCallback(
    (a: Action) => {
      const before = stateRef.current;
      const e = reduce(before, a);
      if (e.state === before) return;
      if (!VIEW_ONLY.has(a.t) && !NO_HISTORY.has(a.t)) history.current.record(snapOf(before), coalesceKey(a));
      stateRef.current = e.state;
      setState(e.state);
      if (e.put.length || e.del.length) saver?.queue(e.put, e.del);
    },
    [saver],
  );

  // Deshacer / rehacer: se vuelve a un estado anterior y se guarda solo lo que cambia.
  const travel = useCallback(
    (dir: 'undo' | 'redo') => {
      const cur = stateRef.current;
      const raw = dir === 'undo' ? history.current.undo(snapOf(cur)) : history.current.redo(snapOf(cur));
      if (!raw) return;
      // El estado de las copias no se deshace.
      const target = { ...raw, settings: { ...raw.settings, backup: cur.settings.backup } };
      const { put, del } = diff(snapOf(cur), target);
      const live = target.projects.filter((p) => !p.trashed);
      const next: State = { ...cur, ...target, sel: live.some((p) => p.id === cur.sel) ? cur.sel : (live[0]?.id ?? 'home') };
      stateRef.current = next;
      setState(next);
      saver?.queue(put, del);
      bump((n) => n + 1);
    },
    [saver],
  );

  const load = useCallback(async (be: Backend) => {
    let docs = await be.all();
    if (docs.length === 0) {
      const lang = detectLang(); // primer arranque: idioma del sistema (inglés si no hay coincidencia)
      docs = import.meta.env.MODE === 'test' ? starterDocs() : sampleDocs(lang);
      await be.put(docs);
    }
    const d = fromDocs(docs);
    const e = reduce(stateRef.current, { t: 'load', ...d });
    stateRef.current = e.state;
    setState(e.state);
  }, []);

  const refreshStatus = useCallback(async () => {
    if (backend) setStatus(await backend.status());
  }, [backend]);

  // Arranque: elegimos el puente (Tauri o memoria) y cargamos si no está bloqueado.
  useEffect(() => {
    (async () => {
      try {
        const be = isTauri() ? await tauriBackend() : memoryBackend();
        const st = await be.status();
        setBackend(be);
        setStatus(st);
        if (!st.locked) await load(be);
      } catch (e) {
        setBootError(errorText(e));
      }
    })();
  }, [load]);

  const lock = useCallback(async () => {
    if (!backend) return;
    await saver?.flush();
    await backend.lock();
    // Borramos los datos de la memoria de la interfaz: solo el núcleo los guarda, cifrados.
    stateRef.current = emptyState;
    setState(emptyState);
    history.current.clear(); // el historial también contiene datos: se borra al bloquear
    setPmOpen(null);
    setSettingsTab(null);
    setSearchOpen(false);
    setStatus(await backend.status());
  }, [backend, saver]);

  const reload = useCallback(async () => {
    if (!backend) return;
    await saver?.flush();
    const st = await backend.status();
    setStatus(st);
    if (!st.locked) await load(backend);
  }, [backend, saver, load]);

  // Bloqueo automático por inactividad (solo si el cifrado está activado).
  const lastAct = useRef(Date.now());
  useEffect(() => {
    const mark = () => { lastAct.current = Date.now(); };
    window.addEventListener('pointerdown', mark, true);
    window.addEventListener('keydown', mark, true);
    const id = window.setInterval(() => {
      const mins = stateRef.current.settings.autoLockMinutes;
      if (status?.encrypted && !status.locked && mins && Date.now() - lastAct.current > mins * 60_000) void lock();
    }, 10_000);
    return () => {
      window.removeEventListener('pointerdown', mark, true);
      window.removeEventListener('keydown', mark, true);
      window.clearInterval(id);
    };
  }, [status, lock]);

  // Atajos: ⌘K buscar · ⌘Z deshacer · ⇧⌘Z o Ctrl+Y rehacer (fuera de los campos de texto,
  // donde se deja el deshacer propio del campo).
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (status?.locked) return;
      const mod = e.metaKey || e.ctrlKey;
      const k = e.key.toLowerCase();
      if (mod && k === 'k') { e.preventDefault(); setSearchOpen(true); return; }
      const el = e.target as HTMLElement | null;
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
      if (typing || !mod) return;
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); travel('undo'); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); travel('redo'); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [status, travel]);

  useEffect(() => { setHour12(state.settings.hour12); }, [state.settings.hour12]);

  // Idioma: el de los ajustes; antes de cargarlos (pantalla de bloqueo), el último usado o el del sistema.
  const lang = state.settings === emptyState.settings ? startupLang() : state.settings.lang;
  useEffect(() => {
    if (state.settings !== emptyState.settings) rememberLang(lang);
    document.documentElement.lang = lang;
  }, [lang, state.settings]);

  // Avisos de recordatorios: se revisan cada 30 s; cada recordatorio avisa una sola vez.
  useEffect(() => {
    if (!status || status.locked) return;
    let alive = true;
    const opened = Date.now();
    const tick = async () => {
      const all = dueNotifications(stateRef.current);
      // «Al abrir la app» desactivado: los que pasaron mientras estaba cerrada no avisan (se marcan como avisados).
      const skip = stateRef.current.settings.showMissed ? [] : all.filter((i) => i.at && i.at.getTime() < opened);
      const due = all.filter((i) => !skip.includes(i));
      if (skip.length) dispatch({ t: 'markNotified', ids: skip.map((d) => d.card.id), at: Date.now() });
      if (!due.length || !(await notificationsAllowed(false)) || !alive) return;
      for (const it of due) await notify(it.card.title || t('ui.app.reminderFallback'), [it.project.name, it.card.note].filter(Boolean).join(' · '));
      if (stateRef.current.settings.sound) playChime();
      dispatch({ t: 'markNotified', ids: due.map((d) => d.card.id), at: Date.now() });
    };
    void tick();
    const id = window.setInterval(() => void tick(), 30_000);
    return () => { alive = false; window.clearInterval(id); };
  }, [status, dispatch]);

  // Copias: cada minuto se mira si toca la automática (archivo) y la interna (dentro de la base de datos).
  const backingUp = useRef(false);
  const stampNow = () => { const d = new Date(), p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
  const runAutoBackup = useCallback(async (force = false) => {
    const bk = stateRef.current.settings.backup;
    if (!backend || backingUp.current) return;
    if (!force && (!bk.auto.on || (bk.auto.last && Date.now() - bk.auto.last < everyMs(bk.auto.every)))) return;
    backingUp.current = true;
    try {
      await saver?.flush();
      const dir = bk.dir ?? (await backend.downloadsDir());
      const name = await backend.autoBackup(dir, stampNow(), bk.auto.keep);
      dispatch({ t: 'backupDone', level: 'auto', patch: { last: Date.now(), lastName: name, error: null } });
      if (force) toast(t('ui.app.backupCreated', { name }));
    } catch (e) {
      dispatch({ t: 'backupDone', level: 'auto', patch: { error: errorText(e) } });
      if (force) toast(t('ui.app.backupFail', { error: errorText(e) }));
    } finally { backingUp.current = false; }
  }, [backend, saver, dispatch, toast]);
  const internalBusy = useRef(false);
  const runInternalBackup = useCallback(async (force = false) => {
    const bk = stateRef.current.settings.backup;
    if (!backend || internalBusy.current) return;
    if (!force && (!bk.internal.on || (bk.internal.last && Date.now() - bk.internal.last < bk.internal.everyMin * 60_000))) return;
    internalBusy.current = true;
    try {
      await saver?.flush();
      await backend.snapshotCreate(bk.internal.keep);
      await backend.internalFile(bk.dir ?? (await backend.downloadsDir()), stampNow(), bk.internal.keep);
      dispatch({ t: 'backupDone', level: 'internal', patch: { last: Date.now() } });
      if (force) toast(t('ui.app.snapshotCreated'));
    } catch (e) { if (force) toast(t('ui.app.snapshotFail', { error: errorText(e) })); }
    finally { internalBusy.current = false; }
  }, [backend, saver, dispatch, toast]);
  useEffect(() => {
    if (!status || status.locked) return;
    const tick = () => { void runAutoBackup(); void runInternalBackup(); };
    const first = window.setTimeout(tick, 5000);
    const id = window.setInterval(tick, 60_000);
    return () => { window.clearTimeout(first); window.clearInterval(id); };
  }, [status, runAutoBackup, runInternalBackup]);


  // Guardar lo pendiente antes de cerrar la ventana.
  useEffect(() => {
    const h = () => void saver?.flush();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [saver]);

  setLang(lang); // global: lo leen t() y las funciones que generan texto fuera de React
  if (bootError) return <div className="boot-error">{t('boot.error', { error: bootError })}</div>;
  if (!backend || !status) return <div className="boot">{t('boot.opening')}</div>;

  // Las relaciones y los resúmenes de las Tablas PM necesitan ver el resto de la app.
  setWorld({ cards: state.cards as unknown as WorldCard[], projects: state.projects, tags: state.tags });

  const ctx: Ctx = {
    state, dispatch, backend, status, refreshStatus, lock, reload, toast,
    openSettings: (tab = 'general') => setSettingsTab(tab),
    undo: () => travel('undo'),
    redo: () => travel('redo'),
    canUndo: history.current.canUndo,
    canRedo: history.current.canRedo,
    openSearch: () => setSearchOpen(true),
    goTo: (project, card) => {
      const target = card ? state.cards.find((c) => c.id === card) : null;
      if (target && target.type === 'note' && target.day) { dispatch({ t: 'day', day: target.day }); return; }
      dispatch({ t: 'select', id: project });
      if (card) {
        setFlashId(card);
        window.setTimeout(() => setFlashId((f) => (f === card ? null : f)), 1600);
      }
    },
    flashId,
    // [[Tarea principal]] o [[Tarea principal/Título de tarjeta]], sin distinguir tildes ni mayúsculas.
    resolveLink: (dest) => {
      const [pName, ...rest] = dest.split('/');
      if (fold(pName) === 'diario' && /^\d{4}-\d{2}-\d{2}$/.test(rest.join('/'))) {
        const day = rest.join('/');
        return { ok: state.cards.some((c) => c.type === 'note' && c.day === day && !c.trashed), go: () => { setBackStack((b) => [...b, state.sel].slice(-30)); dispatch({ t: 'day', day }); } };
      }
      const p = state.projects.find((x) => !x.trashed && fold(x.name) === fold(pName));
      if (!p) return { ok: false, go: () => undefined };
      const cName = rest.join('/');
      const c = cName ? state.cards.find((x) => x.project === p.id && !x.trashed && fold(x.title) === fold(cName)) : null;
      if (cName && !c) {
        // [[Tarea/Tabla PM/Fila]]: abre la tabla y la página de esa fila.
        const [tName, ...rName] = rest;
        const t = state.cards.find((x) => x.project === p.id && !x.trashed && x.type === 'pm' && fold(x.title) === fold(tName));
        const r = t && t.type === 'pm' && rName.length ? t.pm.rows.find((x) => fold(rowTitle(t.pm, x, state.tags)) === fold(rName.join('/'))) : null;
        if (t && r) return { ok: true, go: () => { setBackStack((b) => [...b, state.sel].slice(-30)); ctx.goTo(p.id, t.id); ctx.openPm(t.id, r.id); } };
        return { ok: false, go: () => undefined };
      }
      return {
        ok: true,
        go: () => {
          setBackStack((b) => [...b, state.sel].slice(-30));
          ctx.goTo(p.id, c ? c.id : null);
        },
      };
    },
    linkTargets: (query) => {
      const q = fold(query);
      const out: LinkTarget[] = [];
      for (const c of state.cards) {
        if (c.type === 'note' && c.day && !c.trashed && (!q || c.day.includes(q) || 'diario'.includes(q) || fold(c.title).includes(q))) out.push({ dest: 'Diario/' + c.day, label: t('ui.app.linkJournal', { date: c.day.split('-').reverse().join('/') }), kind: t('ui.label.dailyNote'), color: '#8A6A3A' });
      }
      for (const p of state.projects) {
        if (p.trashed || p.hidden) continue;
        if (!q || fold(p.name).includes(q)) out.push({ dest: p.name, label: p.name, kind: t('ui.label.project'), color: p.color });
        for (const c of state.cards) {
          if (c.project !== p.id || c.trashed || !c.title.trim()) continue;
          if (!q || fold(c.title).includes(q) || fold(p.name).includes(q)) out.push({ dest: p.name + '/' + c.title, label: c.title, kind: p.name, color: p.color });
        }
      }
      return out.slice(0, 40);
    },
    copy: (text, okMsg) => {
      const fallback = () => {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand('copy');
        ta.remove();
        toast(ok ? okMsg : t('ui.app.copyFail'));
      };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => toast(okMsg), fallback);
      else fallback();
    },
    editRequest,
    requestEdit: setEditRequest,
    editEvent,
    setEditEvent,
    openPm: (id, row) => { setPmRowOpen(row ?? null); setPmOpen(id); },
    backupNow: () => runAutoBackup(true),
    snapshotNow: () => runInternalBackup(true),
    openEvent: (id) => {
      const e = state.events.find((x) => x.id === id);
      if (!e) return;
      dispatch({ t: 'calGo', anchor: e.allDay ? e.start : e.start.slice(0, 10) });
      setEditEvent(id);
    },
    canBack: backStack.length > 0,
    goBack: () => {
      const prev = backStack[backStack.length - 1];
      setBackStack((b) => b.slice(0, -1));
      if (prev) dispatch({ t: 'select', id: prev });
    },
  };

  return (
    <AppCtx.Provider value={ctx}>
      <Fragment key={lang}>
      {status.locked ? (
        <LockScreen onUnlocked={reload} />
      ) : (
        <div className={'app' + (state.settings.reduceMotion ? ' reduce-motion' : '')}>
          <Sidebar />
          {state.view === 'trash' ? <Trash /> : state.view === 'today' ? <Today /> : state.view === 'reminders' ? <Reminders /> : state.view === 'journal' ? <Journal /> : state.view === 'calendar' ? <CalendarView /> : state.view === 'graph' ? <Graph /> : <Board />}
          {searchOpen && <Search onClose={() => setSearchOpen(false)} />}
          {pmOpen && <PmTable key={pmOpen + (pmRowOpen ?? '')} cardId={pmOpen} rowId={pmRowOpen} onClose={() => { setPmOpen(null); setPmRowOpen(null); }} />}
          {backStack.length > 0 && (state.view === 'board' || state.view === 'journal') && (
            <button className="back-btn" onClick={ctx.goBack} title={t('ui.app.backTitle')}>← {(() => { const prev = backStack[backStack.length - 1]; const p = state.projects.find((x) => x.id === prev && !x.trashed); return p ? t('ui.app.backTo', { name: p.name }) : t('ui.app.backPrev'); })()}</button>
          )}
          {settingsTab && <Settings tab={settingsTab} setTab={setSettingsTab} onClose={() => setSettingsTab(null)} />}
        </div>
      )}
      {backend.kind === 'memory' && <div className="dev-banner">{t('app.devBanner')}</div>}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      </Fragment>
    </AppCtx.Provider>
  );
}
