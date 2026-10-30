import { describe, expect, it } from 'vitest';
import { DEFAULT_BACKUP, fromDocs, normalizeBackup } from '../lib/model';

describe('ajustes de backup', () => {
  it('por defecto: Descargas y todo apagado', () => {
    expect(DEFAULT_BACKUP.dir).toBeNull();
    expect(DEFAULT_BACKUP.auto.on).toBe(false);
    expect(DEFAULT_BACKUP.internal.on).toBe(false);
  });
  it('migra el ajuste antiguo autoBackup', () => {
    const b = normalizeBackup({ autoBackup: { dir: '/x', every: 'hour', keep: 5, last: 7, lastName: 'a.json', error: null } });
    expect(b.dir).toBe('/x');
    expect(b.auto).toMatchObject({ on: true, every: 'h4', keep: 20, last: 7 });
    const docs = fromDocs([{ id: 'settings', kind: 'settings', parent: null, pos: 0, updated: 1, data: { autoBackup: { dir: '/y', every: 'week' } } }]);
    expect(docs.settings.backup.auto.every).toBe('week');
    expect((docs.settings as unknown as { autoBackup?: unknown }).autoBackup).toBeUndefined();
  });
});
