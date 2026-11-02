// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import * as backendMod from '../lib/backend';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('1.2.0: borrar todos los datos de verdad', () => {
  it('Datos avisa de la desinstalación y "borrar todo" llama a wipeAll', async () => {
    const real = backendMod.memoryBackend;
    let wiped = 0;
    vi.spyOn(backendMod, 'memoryBackend').mockImplementation((...a) => {
      const b = real(...a);
      const orig = b.wipeAll;
      b.wipeAll = async () => { wiped++; await orig(); };
      return b;
    });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getByText('Ajustes'));
    await user.click(await screen.findByText('Datos', { selector: 'nav button' }));
    expect(screen.getByText(/¿Vas a desinstalar OMNIA\?/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Borrar…' }));
    await user.click(screen.getByRole('button', { name: 'Sí, borrar todo' }));
    await screen.findByText('Todos los datos se han borrado');
    expect(wiped).toBe(1);
  }, 20_000);
});
