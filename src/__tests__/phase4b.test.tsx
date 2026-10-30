// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';

afterEach(cleanup);

async function enableEncryption(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('Ajustes'));
  await user.click(screen.getByText('Seguridad', { selector: 'nav button' }));
  await user.click(screen.getByText('Activar…'));
  await user.click(within(screen.getByRole('dialog', { name: 'Ajustes' })).getByRole('checkbox'));
  await user.click(screen.getByText('Continuar'));
  await user.type(screen.getByPlaceholderText('Contraseña (mínimo 10 caracteres)'), 'la sierra al amanecer');
  await user.type(screen.getByPlaceholderText('Repite la contraseña'), 'la sierra al amanecer');
  await user.click(screen.getByText('Continuar'));
  const words = within(await screen.findByRole('list')).getAllByRole('listitem').map((li) => li.textContent!.replace(/^\d+/, ''));
  await user.click(screen.getByText('Ya las he guardado'));
  for (const l of screen.getAllByText(/Palabra n\.º/)) {
    const n = Number(l.textContent!.match(/\d+/)![0]);
    await user.type(within(l.closest('label')!).getByRole('textbox'), words[n - 1]);
  }
  await user.click(screen.getByText('Confirmar y cifrar'));
  await screen.findByRole('heading', { name: '✓ Cifrado activado' });
}

describe('Fase 4b en la interfaz', () => {
  it('el desbloqueo rápido y las actualizaciones son «mejoras continuadas» y no aparecen todavía', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await enableEncryption(user);
    await user.click(screen.getByText('Datos', { selector: 'nav button' }));
    expect(screen.queryByText('Actualizaciones')).toBeNull();
    await user.click(screen.getByText('Seguridad', { selector: 'nav button' }));
    expect(screen.queryByLabelText('Desbloqueo rápido')).toBeNull();
  }, 30_000);
});
