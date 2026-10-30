// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';

afterEach(cleanup);
const td = (r: number, c: number) => document.querySelector(`.pm-grid td[data-r="${r}"][data-c="${c}"]`) as HTMLElement;
const txt = (r: number, c: number) => (td(r, c).querySelector('.pm-view') ?? td(r, c)).textContent;

describe('Detalles de pulido (octubre, 2.ª tanda)', () => {
  it('un clic sobre la nota no cancela el foco del editor (el tablero no lo arrastra)', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    const note = screen.getAllByRole('textbox', { name: 'Contenido de la nota' })[0];
    const ev = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 });
    note.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
    // La cabecera de la tarjeta sí sigue arrastrando.
    const head = note.closest('.card')!.querySelector('.card-head')!;
    const ev2 = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 });
    head.dispatchEvent(ev2);
    expect(ev2.defaultPrevented).toBe(true);
  });

  it('Tabla PM: fórmulas «=» solo en columnas de número; rangos y filas más allá de la tabla valen vacío', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getByText('+ Añadir tarjeta'));
    await user.click(screen.getByRole('menuitem', { name: 'Tabla PM' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Nueva Tabla PM' })).getByText('Proyecto con fases'));
    const dlg = screen.getByRole('dialog', { name: /Tabla PM/ });
    await user.click(within(dlg).getByText('+ Nueva fila'));
    await user.keyboard('A{Enter}B{Enter}C{Tab}');
    await user.click(td(0, 6)); await user.keyboard('4{Enter}');
    await user.click(td(1, 6)); await user.keyboard('5{Enter}');
    await user.click(td(2, 6)); await user.keyboard('=G2*G3{Enter}');
    expect(txt(2, 6)).toBe('20 h');
    await user.click(td(0, 7)); await user.keyboard('=SUMA(G2:G34){Enter}');
    expect(txt(0, 7)).toBe('29 €'); // 4 + 5 + 20, como Excel: las filas que no existen se ignoran
    await user.click(td(1, 7)); await user.keyboard('=G2+G9{Enter}');
    expect(txt(1, 7)).toBe('4 €');
    await user.click(td(2, 7)); await user.keyboard('=A2*B3{Enter}');
    expect(txt(2, 7)).toBe('⚠ Error'); // A y B no son números
    // En una columna de texto, «=» es solo texto.
    await user.click(td(0, 0)); await user.keyboard('=1+1{Enter}');
    expect(txt(0, 0)).toBe('=1+1');
  }, 30_000);
});
