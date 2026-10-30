// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';

afterEach(cleanup);
const cell = (r: number, c: number) => document.querySelector(`.tbl [data-r="${r}"][data-c="${c}"]`) as HTMLElement;
const shown = (r: number, c: number) => (cell(r, c).querySelector('.tbl-text') ?? cell(r, c)).textContent;

describe('Fórmulas con referencias (mejora 1.1.0, fase 4)', () => {
  it('Tabla: «=» calcula con A1, rangos y funciones; el error se explica en una ventana', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getByText('+ Añadir tarjeta'));
    await user.click(screen.getByRole('menuitem', { name: 'Tabla' }));
    // Hay 2 columnas y algunas filas: escribimos números en B2 y B3 y fórmulas en A4.
    await user.click(cell(0, 1)); await user.keyboard('10{Enter}20{Enter}');
    await user.keyboard('{Escape}');
    await user.click(cell(2, 0)); await user.keyboard('=suma(B2:B3){Enter}');
    expect(shown(2, 0)).toBe('30');
    await user.click(cell(2, 0));
    expect(document.querySelector('.tbl-fbar')!.textContent).toContain('A4');
    expect(document.querySelector('.tbl-fbar code')!.textContent).toBe('=suma(B2:B3)');
    // Cambiar un valor la actualiza al momento.
    await user.click(cell(0, 1)); await user.keyboard('15{Enter}');
    expect(shown(2, 0)).toBe('35');
    // Error: la ventana explica qué pasó y Esc la cierra sin perder la tabla.
    await user.click(cell(1, 0)); await user.keyboard('=B2/0{Enter}');
    const bad = within(cell(1, 0)).getByRole('button', { name: /Error/ });
    await user.click(bad);
    const dlg = screen.getByRole('dialog', { name: 'Error en la fórmula' });
    expect(dlg.textContent).toContain('División entre cero');
    expect(dlg.textContent).toContain('=B2/0');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Error en la fórmula' })).toBeNull();
    expect(document.querySelector('.tbl')).not.toBeNull();
  });

  it('Tabla PM: escribir B2 se guarda por identidad, se ve con letras y un error abre la explicación', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getByText('+ Añadir tarjeta'));
    await user.click(screen.getByRole('menuitem', { name: 'Tabla PM' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Nueva Tabla PM' })).getByText('Proyecto con fases'));
    const dlg = screen.getByRole('dialog', { name: /Tabla PM/ });
    await user.click(within(dlg).getByText('+ Nueva fila'));
    await user.keyboard('Uno');
    expect(dlg.querySelector('th[data-letter="A"]')).not.toBeNull();
    await user.click(within(dlg).getByText('+ Nueva columna'));
    await user.click(within(document.querySelector('.pm-pop') as HTMLElement).getByText(/Número/));
    const mine = () => [...dlg.querySelectorAll('td[data-r="0"]')].slice(-1)[0] as HTMLElement;
    await user.click(mine());
    await user.keyboard('=A2*2{Enter}'); // A2 = «Uno»: no es un número
    expect(mine().querySelector('button.err')).not.toBeNull();
    await user.click(mine());
    await user.keyboard('=Z9{Enter}');
    const err = within(dlg).getByRole('button', { name: /Error/ });
    await user.click(err);
    const ex = screen.getByRole('dialog', { name: 'Error en la fórmula' });
    expect(ex.textContent).toContain('No existe la columna Z');
    expect(ex.textContent).toContain('fila 2');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Error en la fórmula' })).toBeNull();
    expect(screen.getByRole('dialog', { name: /Tabla PM/ })).toBeTruthy(); // la tabla sigue abierta
  });
});
