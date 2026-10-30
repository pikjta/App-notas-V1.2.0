import { useState } from 'react';
import { useApp } from '../App';
import { errorText } from '../lib/backend';
import { strength } from '../lib/password';
import { StrengthBar } from './Settings';
import { t } from '../i18n';

export function LockScreen({ onUnlocked }: { onUnlocked: () => Promise<void> }) {
  const { backend } = useApp();
  const [mode, setMode] = useState<'pw' | 'rec'>('pw');
  const [pw, setPw] = useState('');
  const [words, setWords] = useState('');
  const [np, setNp] = useState('');
  const [np2, setNp2] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const unlock = async () => {
    if (!pw || busy) return;
    setBusy(true); setErr('');
    try { await backend.unlock(pw); setPw(''); await onUnlocked(); }
    catch (e) { setErr(errorText(e)); setPw(''); }
    finally { setBusy(false); }
  };

  const recover = async () => {
    if (busy) return;
    if (strength(np).level < 1) { setErr(t('set.lock.tooShort')); return; }
    if (np !== np2) { setErr(t('set.password.newMismatch')); return; }
    setBusy(true); setErr('');
    try { await backend.recover(words, np); setWords(''); setNp(''); setNp2(''); await onUnlocked(); }
    catch (e) { setErr(errorText(e)); }
    finally { setBusy(false); }
  };

  const count = words.trim() ? words.trim().split(/[\s,.]+/).filter((w) => !/^\d+$/.test(w)).length : 0;

  return (
    <div className="lock" role="dialog" aria-label={t('set.lock.label')}>
      <section className="lock-box">
        <h1>Cuaderno</h1>
        <p className="muted">{t('set.lock.protected')}</p>
        {mode === 'pw' ? (
          <>
            <input type="password" autoFocus value={pw} placeholder={t('set.password')} aria-label={t('set.password')} autoComplete="current-password"
              onChange={(e) => { setPw(e.target.value); setErr(''); }} onKeyDown={(e) => e.key === 'Enter' && void unlock()} />
            {err && <p className="err">{err}</p>}
            <button className="primary" disabled={busy || !pw} onClick={() => void unlock()}>{busy ? t('set.lock.decrypting') : t('set.lock.unlock')}</button>
            <button className="link" onClick={() => { setMode('rec'); setErr(''); }}>{t('set.lock.forgot')}</button>
          </>
        ) : (
          <>
            <p>{t('set.lock.recoverIntro')}</p>
            <textarea value={words} onChange={(e) => { setWords(e.target.value); setErr(''); }} spellCheck={false} autoComplete="off" aria-label={t('set.sec.recovery')} rows={4} />
            <span className="muted small">{t('set.lock.wordCount', { n: count })}</span>
            <input type="password" value={np} placeholder={t('set.password.new')} aria-label={t('set.password.new')} autoComplete="new-password" onChange={(e) => setNp(e.target.value)} />
            <StrengthBar pw={np} />
            <input type="password" value={np2} placeholder={t('set.password.repeatNew')} aria-label={t('set.password.repeatNew')} autoComplete="new-password" onChange={(e) => setNp2(e.target.value)} />
            {err && <p className="err">{err}</p>}
            <button className="primary" disabled={busy} onClick={() => void recover()}>{busy ? t('set.lock.checking') : t('set.lock.recover')}</button>
            <button className="link" onClick={() => { setMode('pw'); setErr(''); }}>{t('set.lock.back')}</button>
          </>
        )}
      </section>
    </div>
  );
}
