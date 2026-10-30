import { useEffect, useState } from 'react';
import { useApp } from '../App';
import { errorText } from '../lib/backend';
import type { BackupInfo, SnapshotInfo } from '../lib/backend';
import { pickChecks, strength } from '../lib/password';
import { notificationsAllowed, notify, playChime } from '../lib/notify';
import { COUNTRIES } from '../lib/holidays';
import type { Country } from '../lib/holidays';
import { locale, t, tn } from '../i18n';
import { AUTO_EVERY, INTERNAL_EVERY, LANGUAGES, starterDocs } from '../lib/model';
import type { Language } from '../lib/model';
import { GRID_SIZES } from '../lib/appearance';

export type SettingsTab = 'general' | 'remind' | 'board' | 'backup' | 'security' | 'data';
type Tab = SettingsTab;

export function StrengthBar({ pw }: { pw: string }) {
  if (!pw) return null;
  const s = strength(pw);
  const colors = ['#C8372D', '#E2A23B', '#5E7A2E', '#2F7D4F'];
  return (
    <div className="strength">
      <div className="strength-track"><span style={{ width: `${[15, 40, 70, 100][s.level]}%`, background: colors[s.level] }} /></div>
      <span style={{ color: colors[s.level] }}>{s.label}</span>
    </div>
  );
}

const tabs = (): { id: Tab; name: string }[] => [
  { id: 'general', name: t('set.tab.general') }, { id: 'remind', name: t('set.tab.remind') }, { id: 'board', name: t('set.tab.board') },
  { id: 'backup', name: t('set.tab.backup') }, { id: 'security', name: t('set.tab.security') }, { id: 'data', name: t('set.tab.data') },
];

export function Settings({ tab, setTab, onClose }: { tab: Tab; setTab: (t: Tab) => void; onClose: () => void }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <section className="modal" role="dialog" aria-label={t('set.title')}>
        <header className="modal-head">
          <div><h2>{t('set.title')}</h2><p className="muted small settings-sub">{t('set.sub')}</p></div>
          <nav className="tabs" aria-label={t('set.sections')}>
            {tabs().map((x) => <button key={x.id} className={tab === x.id ? 'on' : ''} onClick={() => setTab(x.id)}>{x.name}</button>)}
          </nav>
          <button className="icon-btn" aria-label={t('set.close')} onClick={onClose}>✕</button>
        </header>
        <div className="modal-body">
          {tab === 'general' ? <General /> : tab === 'remind' ? <RemindSettings /> : tab === 'board' ? <BoardSettings /> : tab === 'backup' ? <Backups /> : tab === 'security' ? <Security /> : <DataSettings setTab={setTab} />}
        </div>
      </section>
    </div>
  );
}

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={'switch' + (on ? ' on' : '')} onClick={() => onChange(!on)}><span /></button>;
}

function General() {
  const { state, dispatch } = useApp();
  const s = state.settings;
  const [q, setQ] = useState('');
  const norm = (x: string) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const list = (Object.keys(COUNTRIES) as Country[]).filter((c) => norm(t(`set.country.${c}`)).includes(norm(q)));
  return (
    <div className="stack">
      <div className="srow">
        <div><h3>{t('settings.language.title')}</h3><p className="muted">{t('settings.language.hint')}</p></div>
        <select value={s.lang} aria-label={t('settings.language.title')} onChange={(e) => dispatch({ t: 'settings', patch: { lang: e.target.value as Language } })}>
          {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </div>
      <div className="srow">
        <div><h3>{t('set.general.timeFormat')}</h3></div>
        <div className="seg" role="group" aria-label={t('set.general.timeFormat')}>
          <button className={!s.hour12 ? 'on' : ''} onClick={() => dispatch({ t: 'settings', patch: { hour12: false } })}>{t('set.general.h24')}</button>
          <button className={s.hour12 ? 'on' : ''} onClick={() => dispatch({ t: 'settings', patch: { hour12: true } })}>{t('set.general.h12')}</button>
        </div>
      </div>
      <div className="srow">
        <div><h3>{t('set.general.weekStart')}</h3></div>
        <div className="seg" role="group" aria-label={t('set.general.weekStart')}>
          <button className={s.weekStart === 1 ? 'on' : ''} onClick={() => dispatch({ t: 'settings', patch: { weekStart: 1 } })}>{t('set.general.monday')}</button>
          <button className={s.weekStart === 0 ? 'on' : ''} onClick={() => dispatch({ t: 'settings', patch: { weekStart: 0 } })}>{t('set.general.sunday')}</button>
        </div>
      </div>
      <div className="stack small-gap">
        <div><h3>{t('set.general.location')}</h3><p className="muted">{t('set.general.locationHint')}</p></div>
        <input type="search" value={q} placeholder={t('set.general.searchCountry')} aria-label={t('set.general.searchCountryLabel')} onChange={(e) => setQ(e.target.value)} />
        <div className="country-list" role="listbox" aria-label={t('set.general.country')}>
          {list.map((c) => (
            <button key={c} role="option" aria-selected={s.country === c} className={'country' + (s.country === c ? ' on' : '')} onClick={() => dispatch({ t: 'settings', patch: { country: c } })}>
              <span>{COUNTRIES[c].flag} {t(`set.country.${c}`)}</span><span className="tag-mini">{t('set.general.holidays')}</span>
            </button>
          ))}
          {!list.length && <p className="muted small">{t('set.general.noResults', { q })}</p>}
        </div>
      </div>
    </div>
  );
}

function BoardSettings() {
  const { state, dispatch } = useApp();
  const s = state.settings;
  const set = (patch: Partial<typeof s>) => dispatch({ t: 'settings', patch });
  return (
    <div className="stack">
      <div className="srow">
        <div><h3>{t('set.boardTab.focus')}</h3><p className="muted">{t('set.boardTab.focusHint')}</p></div>
        <div className="seg" role="group" aria-label={t('set.boardTab.focus')}>
          {([['off', t('set.boardTab.focusOff')], ['soft', t('set.boardTab.focusSoft')], ['strong', t('set.boardTab.focusStrong')]] as const).map(([k, n]) => <button key={k} className={s.focus === k ? 'on' : ''} onClick={() => set({ focus: k })}>{n}</button>)}
        </div>
      </div>
      <div className="srow">
        <div><h3>{t('set.boardTab.snap')}</h3><p className="muted">{t('set.boardTab.snapHint')}</p></div>
        <Switch on={s.snapOnOpen} label={t('set.boardTab.snap')} onChange={(v) => set({ snapOnOpen: v, snap: v })} />
      </div>
      <div className="srow">
        <div><h3>{t('set.boardTab.grid')}</h3></div>
        <div className="seg" role="group" aria-label={t('set.boardTab.grid')}>
          {GRID_SIZES.map((g) => <button key={g.value} className={s.grid === g.value ? 'on' : ''} onClick={() => set({ grid: g.value })}>{g.name}</button>)}
        </div>
      </div>
      <div className="srow">
        <div><h3>{t('set.boardTab.reduceMotion')}</h3><p className="muted">{t('set.boardTab.reduceMotionHint')}</p></div>
        <Switch on={s.reduceMotion} label={t('set.boardTab.reduceMotion')} onChange={(v) => set({ reduceMotion: v })} />
      </div>
    </div>
  );
}

function DataSettings({ setTab }: { setTab: (t: Tab) => void }) {
  const { backend, reload, toast } = useApp();
  const [bytes, setBytes] = useState<number | null>(null);
  const [step, setStep] = useState<'idle' | 'ask' | 'busy'>('idle');
  useEffect(() => { backend.all().then((d) => setBytes(new Blob([JSON.stringify(d)]).size)).catch(() => setBytes(null)); }, [backend]);
  const size = bytes === null ? '…' : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  const wipe = async () => {
    setStep('busy');
    try {
      const ids = (await backend.all()).map((d) => d.id);
      await backend.remove(ids);
      await backend.put(starterDocs());
      await reload();
      toast(t('set.data.wiped'));
    } finally { setStep('idle'); }
  };
  return (
    <div className="stack">
      <div className="srow">
        <div><h3>{t('set.data.manual')}</h3><p className="muted">{t('set.data.manualHint')}</p></div>
        <button className="tool" onClick={() => setTab('backup')}>{t('set.data.open')}</button>
      </div>
      <div className="srow">
        <div><h3>{t('set.data.space')}</h3><p className="muted">{t('set.data.spaceHint')}</p></div>
        <b>{size}</b>
      </div>
      <div className="srow">
        <div><h3>{t('set.data.wipe')}</h3><p className="muted">{step === 'ask' ? t('set.data.wipeAsk') : t('set.data.wipeHint')}</p></div>
        {step === 'idle' && <button className="danger" onClick={() => setStep('ask')}>{t('set.data.wipeBtn')}</button>}
        {step !== 'idle' && <div className="row"><button className="tool" disabled={step === 'busy'} onClick={() => setStep('idle')}>{t('set.cancel')}</button><button className="danger" disabled={step === 'busy'} onClick={() => void wipe()}>{t('set.data.wipeConfirm')}</button></div>}
      </div>
    </div>
  );
}

type Step =
  | { s: 'idle' }
  | { s: 'intro'; agree: boolean }
  | { s: 'password'; pw: string; pw2: string }
  | { s: 'words'; words: string[]; rotate: boolean }
  | { s: 'verify'; words: string[]; picks: number[]; answers: string[]; rotate: boolean }
  | { s: 'change' } | { s: 'rotate' } | { s: 'disable' };

function Security() {
  const { backend, status, refreshStatus, state, dispatch, toast, copy, lock } = useApp();
  const [step, setStep] = useState<Step>({ s: 'idle' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setErr('');
    try { await fn(); } catch (e) { setErr(errorText(e)); } finally { setBusy(false); }
  };
  const reset = () => { setStep({ s: 'idle' }); setErr(''); setCur(''); setPw(''); setPw2(''); };
  const cancelSetup = () => { void backend.vaultCancel(); reset(); };

  const minutes = state.settings.autoLockMinutes;

  if (step.s === 'intro') {
    return (
      <div className="stack">
        <div className="warn">
          <h3>{t('set.sec.introTitle')}</h3>
          <p>{t('set.sec.introA')} <b>{t('set.sec.introWords')}</b>{t('set.sec.introB')} <b>{t('set.sec.introOnly')}</b> {t('set.sec.introC')}</p>
          <label className="check-line"><input type="checkbox" checked={step.agree} onChange={() => setStep({ s: 'intro', agree: !step.agree })} /> {t('set.sec.agree')}</label>
        </div>
        <div className="row-end"><button className="tool" onClick={reset}>{t('set.cancel')}</button><button className="primary" disabled={!step.agree} onClick={() => setStep({ s: 'password', pw: '', pw2: '' })}>{t('set.continue')}</button></div>
      </div>
    );
  }
  if (step.s === 'password') {
    return (
      <div className="stack">
        <h3>{t('set.sec.step1')}</h3>
        <input type="password" autoFocus value={step.pw} placeholder={t('set.sec.pwPlaceholder')} autoComplete="new-password" onChange={(e) => setStep({ ...step, pw: e.target.value })} />
        <StrengthBar pw={step.pw} />
        <input type="password" value={step.pw2} placeholder={t('set.sec.pwRepeat')} autoComplete="new-password" onChange={(e) => setStep({ ...step, pw2: e.target.value })} />
        <p className="muted small">{t('set.sec.pwTip')}</p>
        {err && <p className="err">{err}</p>}
        <div className="row-end">
          <button className="tool" onClick={reset}>{t('set.cancel')}</button>
          <button className="primary" disabled={busy} onClick={() => run(async () => {
            if (step.pw !== step.pw2) throw t('set.password.mismatch');
            const words = await backend.vaultPrepare(step.pw);
            setStep({ s: 'words', words, rotate: false });
          })}>{busy ? t('set.sec.generating') : t('set.continue')}</button>
        </div>
      </div>
    );
  }
  if (step.s === 'words') {
    return (
      <div className="stack">
        <h3>{step.rotate ? t('set.sec.wordsTitleNew') : t('set.sec.wordsTitle')}</h3>
        <p>{t('set.sec.wordsHintA')} <b>{t('set.sec.wordsInOrder')}</b>{t('set.sec.wordsHintB')}</p>
        <ol className="words">{step.words.map((w, i) => <li key={i}><span>{i + 1}</span>{w}</li>)}</ol>
        <div className="row wrap no-print">
          <button className="tool small-btn" onClick={() => copy(step.words.join(' '), t('set.sec.wordsCopied'))}>{t('set.sec.copy')}</button>
          <button className="tool small-btn" onClick={() => saveWords(step.words)}>{t('set.sec.download')}</button>
          <button className="tool small-btn" onClick={() => window.print()}>{t('set.sec.print')}</button>
        </div>
        <div className="row-end">
          {!step.rotate && <button className="tool" onClick={cancelSetup}>{t('set.cancel')}</button>}
          <button className="primary" onClick={() => setStep({ s: 'verify', words: step.words, picks: pickChecks(), answers: ['', '', ''], rotate: step.rotate })}>{t('set.sec.saved')}</button>
        </div>
      </div>
    );
  }
  if (step.s === 'verify') {
    return (
      <div className="stack">
        <h3>{step.rotate ? t('set.sec.verifyTitleNew') : t('set.sec.verifyTitle')}</h3>
        <p className="muted">{t('set.sec.verifyHint')}</p>
        <div className="verify">
          {step.picks.map((p, k) => (
            <label key={p}>{t('set.sec.wordN', { n: p + 1 })}
              <input value={step.answers[k]} autoComplete="off" spellCheck={false} onChange={(e) => { const a = step.answers.slice(); a[k] = e.target.value; setStep({ ...step, answers: a }); setErr(''); }} />
            </label>
          ))}
        </div>
        {err && <p className="err">{err}</p>}
        <div className="row-end">
          <button className="tool" onClick={() => setStep({ s: 'words', words: step.words, rotate: step.rotate })}>{t('set.sec.showWords')}</button>
          <button className="primary" disabled={busy} onClick={() => run(async () => {
            if (step.rotate) {
              const norm = (w: string) => w.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
              step.picks.forEach((p, k) => { if (norm(step.words[p]) !== norm(step.answers[k])) throw t('set.sec.wordMismatch', { n: p + 1 }); });
            } else {
              await backend.vaultConfirm(step.picks.map((p, k) => [p, step.answers[k]] as [number, string]));
              await refreshStatus();
            }
            toast(step.rotate ? t('set.sec.rotatedToast') : t('set.sec.enabledToast'));
            reset();
          })}>{busy ? t('set.sec.encrypting') : step.rotate ? t('set.sec.confirm') : t('set.sec.confirmEncrypt')}</button>
        </div>
      </div>
    );
  }
  if (step.s === 'change' || step.s === 'rotate' || step.s === 'disable') {
    const title = { change: t('set.sec.changeTitle'), rotate: t('set.sec.rotateTitle'), disable: t('set.sec.disableTitle') }[step.s];
    return (
      <div className="stack">
        <h3>{title}</h3>
        {step.s === 'rotate' && <p className="muted">{t('set.sec.rotateHint')}</p>}
        <input type="password" autoFocus value={cur} placeholder={t('set.sec.currentPassword')} autoComplete="current-password" onChange={(e) => setCur(e.target.value)} />
        {step.s === 'change' && (
          <>
            <input type="password" value={pw} placeholder={t('set.password.new')} autoComplete="new-password" onChange={(e) => setPw(e.target.value)} />
            <StrengthBar pw={pw} />
            <input type="password" value={pw2} placeholder={t('set.password.repeatNew')} autoComplete="new-password" onChange={(e) => setPw2(e.target.value)} />
          </>
        )}
        {err && <p className="err">{err}</p>}
        <div className="row-end">
          <button className="tool" onClick={reset}>{t('set.cancel')}</button>
          <button className={step.s === 'disable' ? 'danger' : 'primary'} disabled={busy} onClick={() => run(async () => {
            if (step.s === 'change') {
              if (pw !== pw2) throw t('set.password.newMismatch');
              await backend.changePassword(cur, pw); toast(t('set.sec.changedToast')); reset();
            } else if (step.s === 'rotate') {
              const words = await backend.rotateWords(cur); setCur(''); setStep({ s: 'words', words, rotate: true });
            } else {
              await backend.disable(cur); await refreshStatus(); toast(t('set.sec.disabledToast')); reset();
            }
          })}>{busy ? t('set.sec.moment') : step.s === 'disable' ? t('set.sec.disable') : t('set.continue')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      {!status.encrypted ? (
        <div className="srow">
          <div><h3>{t('set.sec.encryptTitle')}</h3><p className="muted">{t('set.sec.encryptHint')}</p></div>
          <button className="primary" onClick={() => setStep({ s: 'intro', agree: false })}>{t('set.sec.activate')}</button>
        </div>
      ) : (
        <>
          <div className="srow">
            <div>
              <h3 className="ok">{t('set.sec.encryptedOn')}</h3>
              <p className="muted small">{t('set.sec.techInfo')}</p>
            </div>
            <button className="tool" onClick={() => void lock()}>{t('set.sec.lockNow')}</button>
          </div>
          <div className="srow">
            <div><h3>{t('set.sec.autoLock')}</h3><p className="muted">{t('set.sec.autoLockHint')}</p></div>
            <div className="row">
              {minutes !== null && (
                <select value={minutes} onChange={(e) => dispatch({ t: 'settings', patch: { autoLockMinutes: Number(e.target.value) } })} aria-label={t('set.sec.idleTime')}>
                  {([[5, t('set.sec.min5')], [15, t('set.sec.min15')], [30, t('set.sec.min30')], [60, t('set.sec.min60')], [120, t('set.sec.min120')], [240, t('set.sec.min240')]] as const).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              )}
              <button role="switch" aria-checked={minutes !== null} className={'switch' + (minutes !== null ? ' on' : '')} aria-label={t('set.sec.autoLock')}
                onClick={() => dispatch({ t: 'settings', patch: { autoLockMinutes: minutes === null ? 15 : null } })}><span /></button>
            </div>
          </div>
          <div className="srow"><div><h3>{t('set.password')}</h3><p className="muted">{t('set.sec.passwordHint')}</p></div><button className="tool" onClick={() => setStep({ s: 'change' })}>{t('set.sec.change')}</button></div>
          <div className="srow"><div><h3>{t('set.sec.recovery')}</h3><p className="muted">{t('set.sec.recoveryHint')}</p></div><button className="tool" onClick={() => setStep({ s: 'rotate' })}>{t('set.sec.generateNew')}</button></div>
          <div className="srow"><div><h3>{t('set.sec.disableTitle')}</h3><p className="muted">{t('set.sec.disableHint')}</p></div><button className="tool danger-text" onClick={() => setStep({ s: 'disable' })}>{t('set.sec.disableBtn')}</button></div>
        </>
      )}
    </div>
  );
}

function saveWords(words: string[]) {
  try {
    const text = t('set.sec.wordsFileTitle') + '\n\n' + words.map((w, i) => `${i + 1}. ${w}`).join('\n') + '\n';
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a'); a.href = url; a.download = 'cuaderno_palabras.txt'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch { /* sin descarga en las pruebas */ }
}

function Backups() {
  const { state, dispatch, backend, status, reload, toast, backupNow, snapshotNow } = useApp();
  const bk = state.settings.backup;
  const setBk = (patch: Partial<typeof bk>) => dispatch({ t: 'settings', patch: { backup: { ...bk, ...patch } } });
  const setAuto = (patch: Partial<typeof bk.auto>) => setBk({ auto: { ...bk.auto, ...patch } });
  const setInternal = (patch: Partial<typeof bk.internal>) => setBk({ internal: { ...bk.internal, ...patch } });
  const [downloads, setDownloads] = useState(t('set.backup.downloads'));
  useEffect(() => { backend.downloadsDir().then(setDownloads).catch(() => undefined); }, [backend]);
  const dir = bk.dir ?? downloads;
  const fmt = (ms: number) => new Date(ms).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const stamp = () => { const d = new Date(); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');

  // Copias internas
  const [snaps, setSnaps] = useState<SnapshotInfo[] | null>(null);
  const [askRestore, setAskRestore] = useState<number | null>(null);
  useEffect(() => { backend.snapshotList().then(setSnaps).catch(() => setSnaps(null)); }, [backend, bk.internal.last]);

  // Exportar / importar
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [info, setInfo] = useState<(BackupInfo & { path: string }) | null>(null);
  const [ready, setReady] = useState(false);
  const [secret, setSecret] = useState('');
  const [useWords, setUseWords] = useState(false);

  const pickFolder = async () => { const d = await backend.pickFolder(); if (d) setBk({ dir: d }); };
  const exportNow = async () => {
    setErr(''); setBusy('export');
    try {
      const name = await backend.manualBackup(dir, stamp());
      dispatch({ t: 'backupDone', level: 'manual', patch: { last: Date.now(), lastName: name } });
      setExporting(false); toast(t('set.backup.created'));
    } catch (e) { setErr(errorText(e)); } finally { setBusy(null); }
  };
  const choose = async () => {
    setErr(''); setSecret(''); setReady(false); setInfo(null);
    try {
      const path = await backend.pickOpenPath();
      if (path) setInfo({ ...(await backend.backupInspect(path)), path });
    } catch (e) { setErr(/copia|Cuaderno/i.test(errorText(e)) ? t('set.backup.notBackup') : t('set.backup.unreadable')); }
  };
  const importNow = async () => {
    if (!info) return;
    setBusy('import'); setErr('');
    try {
      const n = await backend.backupImport(info.path, info.encrypted ? secret : null, useWords);
      await reload(); setInfo(null); setReady(false); setSecret(''); setImporting(false); toast(tn('set.backup.imported', n));
    } catch (e) { setErr(errorText(e)); } finally { setBusy(null); }
  };
  const restore = async (id: number) => {
    setBusy('restore'); setErr('');
    try { await backend.snapshotRestore(id, bk.internal.keep); await reload(); setAskRestore(null); toast(t('set.backup.restored')); }
    catch (e) { setErr(errorText(e)); } finally { setBusy(null); }
  };
  const keepSlider = (value: number, onChange: (n: number) => void, label: string) => (
    <label className="small">{t('set.backup.keepLast', { n: value })}
      <input type="range" min={20} max={100} step={5} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );

  return (
    <div className="stack">
      <p className="muted">{status.encrypted ? t('set.backup.introEnc') : t('set.backup.intro')}</p>

      <div className="srow">
        <div>
          <h3>{t('set.backup.folder')}</h3>
          <code className="ellipsis" title={dir}>{dir}</code>
          <ul className="bk-tree small muted">
            <li>{t('set.backup.treeAuto')}</li><li>{t('set.backup.treeInternal')}</li><li>{t('set.backup.treeManual')}</li>
          </ul>
        </div>
        <div className="row">
          <button className="tool" onClick={() => void pickFolder()}>{t('set.backup.pickFolder')}</button>
          {bk.dir && <button className="tool" onClick={() => setBk({ dir: null })}>{t('set.backup.backToDownloads')}</button>}
        </div>
      </div>

      <div className="auto-bk">
        <div className="srow">
          <div><h3>{t('set.backup.autoOn')}</h3><p className="muted">{t('set.backup.autoHint')}</p></div>
          <Switch on={bk.auto.on} label={t('set.backup.autoOn')} onChange={(v) => setAuto({ on: v })} />
        </div>
        {bk.auto.on && (
          <div className="stack small-gap auto-bk-body">
            <div className="row wrap">
              <label className="small">{t('set.backup.frequency')}
                <select value={bk.auto.every} onChange={(e) => setAuto({ every: e.target.value as typeof bk.auto.every })}>
                  {AUTO_EVERY.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </label>
              {keepSlider(bk.auto.keep, (n) => setAuto({ keep: n }), t('set.backup.keepAuto'))}
              <span className="grow" />
              <button className="primary small-btn" disabled={busy === 'auto'} onClick={async () => { setBusy('auto'); await backupNow(); setBusy(null); }}>{busy === 'auto' ? t('set.backup.saving') : t('set.backup.doNow')}</button>
            </div>
            {bk.auto.error ? <p className="err small">{t('set.backup.lastFailed', { error: bk.auto.error })}</p> : bk.auto.last && <p className="small ok">{t('set.backup.lastOk', { date: fmt(bk.auto.last), name: bk.auto.lastName ?? '' })}</p>}
          </div>
        )}
      </div>

      <div className="auto-bk">
        <div className="srow">
          <div><h3>{t('set.backup.internalOn')}</h3><p className="muted">{t('set.backup.internalHint')}</p></div>
          <Switch on={bk.internal.on} label={t('set.backup.internalOn')} onChange={(v) => setInternal({ on: v })} />
        </div>
        {bk.internal.on && (
          <div className="stack small-gap auto-bk-body">
            <div className="row wrap">
              <label className="small">{t('set.backup.every')}
                <select value={bk.internal.everyMin} onChange={(e) => setInternal({ everyMin: Number(e.target.value) })}>
                  {INTERNAL_EVERY.map((m) => <option key={m} value={m}>{m < 60 ? t('set.backup.everyMin', { n: m }) : t('set.backup.everyHour', { n: m / 60 })}</option>)}
                </select>
              </label>
              {keepSlider(bk.internal.keep, (n) => setInternal({ keep: n }), t('set.backup.keepInternal'))}
              <span className="grow" />
              <button className="tool small-btn" disabled={busy === 'internal'} onClick={async () => { setBusy('internal'); await snapshotNow(); setSnaps(await backend.snapshotList().catch(() => null)); setBusy(null); }}>{t('set.backup.createNow')}</button>
            </div>
          </div>
        )}
        {snaps && snaps.length > 0 && (
          <div className="stack small-gap auto-bk-body">
            <h3>{t('set.backup.recent', { n: snaps.length })}</h3>
            {snaps.slice(0, 5).map((x) => (
              <div className="row wrap" key={x.id}>
                <span className="small grow">{tn('set.backup.snapItem', x.docs, { date: fmt(x.at) })}</span>
                {askRestore === x.id
                  ? <><span className="small">{t('set.backup.restoreAsk')}</span><button className="danger small-btn" disabled={busy === 'restore'} onClick={() => void restore(x.id)}>{t('set.backup.restoreYes')}</button><button className="tool small-btn" onClick={() => setAskRestore(null)}>{t('set.backup.no')}</button></>
                  : <button className="tool small-btn" onClick={() => setAskRestore(x.id)}>{t('set.backup.restore')}</button>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="srow">
        <div><h3>{t('set.backup.export')}</h3><p className="muted">{status.encrypted ? t('set.backup.exportHintEnc') : t('set.backup.exportHint')}{bk.manual.last ? ' ' + t('set.backup.exportLast', { date: fmt(bk.manual.last) }) : ''}</p></div>
        {exporting
          ? <div className="row"><button className="tool" onClick={() => setExporting(false)}>{t('set.cancel')}</button><button className="primary" disabled={busy === 'export'} onClick={() => void exportNow()}>{t('set.backup.exportNow')}</button></div>
          : <button className="primary" onClick={() => setExporting(true)}>{t('set.backup.export')}</button>}
      </div>

      <div className="srow">
        <div><h3>{t('set.backup.import')}</h3><p className="muted">{t('set.backup.importHint')}</p></div>
        {importing
          ? <button className="tool" onClick={() => { setImporting(false); setInfo(null); setReady(false); setErr(''); }}>{t('set.cancel')}</button>
          : <button className="tool" onClick={() => { setImporting(true); }}>{t('set.backup.import')}</button>}
      </div>
      {importing && !info && <div className="row"><button className="tool" onClick={() => void choose()}>{t('set.backup.chooseFile')}</button></div>}
      {importing && info && info.encrypted && !ready && (
        <div className="warn">
          <h3>{t('set.backup.encryptedCopy')}</h3>
          {useWords ? <textarea rows={3} value={secret} onChange={(e) => setSecret(e.target.value)} aria-label={t('set.backup.copyWords')} /> : <input type="password" value={secret} placeholder={t('set.backup.copyPassword')} aria-label={t('set.backup.copyPassword')} onChange={(e) => setSecret(e.target.value)} />}
          <div className="row-end">
            <button className="tool" onClick={() => setUseWords(!useWords)}>{useWords ? t('set.backup.usePassword') : t('set.backup.useWords')}</button>
            <button className="primary" disabled={!secret.trim()} onClick={() => setReady(true)}>{t('set.backup.decrypt')}</button>
          </div>
        </div>
      )}
      {importing && info && (!info.encrypted || ready) && (
        <div className="warn">
          <h3>{t('set.backup.replaceTitle')}</h3>
          <p><b>{tn('set.backup.items', info.docs)}</b> · {t(info.encrypted ? 'set.backup.copyOfEnc' : 'set.backup.copyOf', { date: new Date(info.exportedAt).toLocaleString(locale()) })}</p>
          <p className="small">{t('set.backup.replaceHint')}</p>
          <div className="row-end"><button className="tool" onClick={() => { setInfo(null); setReady(false); }}>{t('set.cancel')}</button><button className="danger" disabled={busy === 'import'} onClick={() => void importNow()}>{busy === 'import' ? t('set.backup.importing') : t('set.backup.replaceImport')}</button></div>
        </div>
      )}
      {err && <p className="err">{err}</p>}
    </div>
  );
}

function RemindSettings() {
  const { state, dispatch, toast } = useApp();
  const s = state.settings;
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => { void notificationsAllowed(false).then(setAllowed); }, []);
  return (
    <div className="stack">
      <div className="srow">
        <div><h3>{t('set.remind.notifications')}</h3><p className="muted">{t('set.remind.notificationsHint')}</p>
          {allowed === false && s.notify && <p className="small err">{t('set.remind.noPermission')}</p>}</div>
        <Switch on={s.notify} label={t('set.remind.notifications')} onChange={async (on) => { dispatch({ t: 'settings', patch: { notify: on } }); if (on) setAllowed(await notificationsAllowed(true)); }} />
      </div>
      <div className="srow">
        <div><h3>{t('set.remind.sound')}</h3><p className="muted">{t('set.remind.soundHint')}</p></div>
        <div className="row"><button className="tool small-btn" onClick={() => playChime()}>{t('set.remind.try')}</button><Switch on={s.sound} label={t('set.remind.sound')} onChange={(v) => dispatch({ t: 'settings', patch: { sound: v } })} /></div>
      </div>
      <div className="srow">
        <div><h3>{t('set.remind.lead')}</h3><p className="muted">{t('set.remind.leadHint')}</p></div>
        <select value={s.leadMin} aria-label={t('set.remind.lead')} onChange={(e) => dispatch({ t: 'settings', patch: { leadMin: Number(e.target.value) as 0 | 5 | 15 | 60 } })}>
          <option value={0}>{t('set.remind.lead0')}</option><option value={5}>{t('set.remind.lead5')}</option><option value={15}>{t('set.remind.lead15')}</option><option value={60}>{t('set.remind.lead60')}</option>
        </select>
      </div>
      <div className="srow">
        <div><h3>{t('set.remind.onOpen')}</h3><p className="muted">{t('set.remind.onOpenHint')}</p></div>
        <Switch on={s.showMissed} label={t('set.remind.onOpen')} onChange={(v) => dispatch({ t: 'settings', patch: { showMissed: v } })} />
      </div>
      <div className="srow">
        <div><h3>{t('set.remind.test')}</h3><p className="muted">{t('set.remind.testHint')}</p></div>
        <button className="tool" onClick={async () => { if (await notificationsAllowed(true)) { await notify('Cuaderno', t('set.remind.testBody')); if (s.sound) playChime(); setAllowed(true); } else toast(t('set.remind.denied')); }}>{t('set.remind.send')}</button>
      </div>
    </div>
  );
}
