// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';

afterEach(cleanup);

describe('etapa 6: ajustes y apariencia', () => {
  it('Ajustes tiene las 6 pestañas y los ajustes de Tablero actúan', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getByText('Ajustes'));
    const nav = await screen.findByRole('navigation', { name: 'Secciones' });
    expect([...nav.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['General', 'Recordatorios', 'Tablero', 'Backup', 'Seguridad', 'Datos']);
    expect(screen.getByText('Los cambios se guardan al instante, solo en este dispositivo.')).toBeTruthy();
    await user.click(screen.getByText('Tablero', { selector: 'nav button' }));
    await user.click(screen.getByRole('button', { name: 'Intenso' }));
    await user.click(screen.getByRole('button', { name: 'Amplia' }));
    await user.click(screen.getByRole('switch', { name: 'Reducir animaciones' }));
    await user.click(screen.getByLabelText('Cerrar'));
    expect(document.querySelector('main.board')?.className).toContain('focus-strong');
    expect(document.querySelector('.app')?.className).toContain('reduce-motion');
  }, 20_000);

  it('nombre de la sesión, fuente, barra y tablero se personalizan', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getByTitle('Haz clic para cambiar el nombre de la sesión'));
    const input = screen.getByLabelText('Nombre de la sesión');
    await user.clear(input);
    await user.type(input, 'Mi estudio{Enter}');
    expect(screen.getByText('Mi estudio')).toBeTruthy();
    await user.click(screen.getByLabelText('Fuente del nombre'));
    await user.click(screen.getByRole('button', { name: /Máquina/ }));
    await user.click(screen.getByRole('button', { name: 'Negrita' }));
    expect((screen.getByText('Mi estudio') as HTMLElement).style.fontFamily).toContain('Courier');
    await user.click(screen.getByRole('button', { name: 'Listo' }));
    await user.click(screen.getByLabelText('Personalizar barra'));
    await user.click(screen.getByRole('button', { name: 'Cobalto' }));
    expect((document.querySelector('aside.side') as HTMLElement).style.getPropertyValue('--side-bg')).toBe('#1F3F7A');
    await user.click(screen.getByRole('button', { name: 'Listo' }));
    await user.click(screen.getByText('Personalizar tablero'));
    await user.click(screen.getByRole('button', { name: 'Taller' }));
    expect(document.querySelector('main.board')?.className).toContain('tex-lienzo');
    await user.click(screen.getByRole('tab', { name: 'Tarjetas' }));
    expect(screen.getByText(/Color · Crema/)).toBeTruthy();
  }, 20_000);
});
