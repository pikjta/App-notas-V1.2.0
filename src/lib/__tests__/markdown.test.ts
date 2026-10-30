import { describe, expect, it } from 'vitest';
import { parse, toggleTask } from '../markdown';
import { strength, pickChecks } from '../password';

describe('markdown', () => {
  it('reconoce los bloques', () => {
    const b = parse('## Plan\n- [ ] Lijar\n  - [x] Imprimar\n- punto\n1. uno\n> cita\n---\ntexto\n');
    expect(b.map((x) => x.k)).toEqual(['h', 'task', 'task', 'li', 'li', 'quote', 'hr', 'p', 'gap']);
    expect(b[2]).toMatchObject({ done: true, indent: 1 });
  });
  it('marca y desmarca tareas', () => {
    expect(toggleTask('- [ ] a\n- [x] b', 0)).toBe('- [x] a\n- [x] b');
    expect(toggleTask('- [ ] a\n- [x] b', 1)).toBe('- [ ] a\n- [ ] b');
  });
  it('el HTML escrito por el usuario se queda como texto', () => {
    const b = parse('<img src=x onerror=alert(1)>');
    expect(b[0]).toMatchObject({ k: 'p', text: '<img src=x onerror=alert(1)>' });
  });
});

describe('contraseñas', () => {
  it('exige 10 caracteres y favorece las frases', () => {
    expect(strength('corta').level).toBe(0);
    expect(strength('password1234').level).toBe(1);
    expect(strength('la sierra al amanecer, 2026').level).toBe(3);
  });
  it('elige 3 posiciones distintas', () => {
    const p = pickChecks();
    expect(new Set(p).size).toBe(3);
    expect(p.every((i) => i >= 0 && i < 24)).toBe(true);
  });
});
