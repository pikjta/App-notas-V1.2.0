// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Tabla PM · arrastrar columnas sin tirones (mejora 1.1.0, fase 2)', () => {
  it('resalta la columna de destino sin volver a dibujar la tabla y la mueve al soltar', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getByText('+ Añadir tarjeta'));
    await user.click(screen.getByRole('menuitem', { name: 'Tabla PM' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Nueva Tabla PM' })).getByText('Encargo artístico'));
    const dlg = screen.getByRole('dialog', { name: /Tabla PM · Encargo artístico/ });
    const ths = () => [...dlg.querySelectorAll<HTMLElement>('th[data-col]')];
    const order = () => ths().map((t) => t.dataset.col);
    const [a, , c] = ths();
    const before = order();
    // El navegador de pruebas no calcula posiciones: se indica qué columna hay bajo el ratón.
    let under: HTMLElement = a;
    document.elementFromPoint = () => under;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((f) => { f(0); return 1; });
    fireEvent(a, new MouseEvent('pointerdown', { button: 0, clientX: 10, clientY: 10, bubbles: true }));
    under = c;
    const mv = new MouseEvent('pointermove', { clientX: 200, clientY: 10, bubbles: true });
    act(() => { window.dispatchEvent(mv); });
    expect(c.classList.contains('drop')).toBe(true);
    // Se agarra la columna: sin selección de texto y con una etiqueta que sigue al ratón.
    expect(document.body.classList.contains('pm-grabbing')).toBe(true);
    expect(a.textContent).toContain(document.querySelector('.pm-ghost')!.textContent!);
    expect(a.classList.contains('drop')).toBe(false);
    // Es el mismo elemento del DOM: no se ha vuelto a dibujar.
    expect(ths()[2]).toBe(c);
    act(() => { window.dispatchEvent(new MouseEvent('pointerup', { clientX: 200, clientY: 10, bubbles: true })); });
    expect(dlg.querySelector('th.drop')).toBeNull();
    expect(document.body.classList.contains('pm-grabbing')).toBe(false);
    expect(document.querySelector('.pm-ghost')).toBeNull();
    const after = order();
    expect(after).not.toEqual(before);
    expect(after.indexOf(before[0]!)).toBe(2);
  }, 30_000);
});

describe('Tabla PM · duplicar en edición', () => {
  it('«Duplicar tabla» cierra la tabla abierta y se ven las dos tarjetas', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getByText('+ Añadir tarjeta'));
    await user.click(screen.getByRole('menuitem', { name: 'Tabla PM' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Nueva Tabla PM' })).getByText('Encargo artístico'));
    const dlg = screen.getByRole('dialog', { name: /Tabla PM/ });
    const before = document.querySelectorAll('.pm-compact').length;
    await user.click(within(dlg).getByLabelText('Opciones de la tabla'));
    await user.click(screen.getByText('⎘ Duplicar tabla'));
    expect(dlg.isConnected).toBe(false);
    expect(document.querySelectorAll('.pm-compact').length).toBe(before + 1);
  }, 30_000);
});
