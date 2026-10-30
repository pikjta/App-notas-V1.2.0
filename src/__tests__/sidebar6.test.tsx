// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const rows = () => [...document.querySelectorAll<HTMLElement>('.proj-row[data-proj]')];
const names = () => rows().map((r) => r.querySelector('.side-name')!.textContent);

async function setup() {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { name: 'Inicio' });
  return user;
}
async function addProject(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByText('+ Tarea principal'));
  await user.type(screen.getByLabelText('Nombre de la tarea principal'), name + '{Enter}');
}

describe('Barra lateral · mover tareas e iconos (mejora 1.1.0, fase 6)', () => {
  it('Alt+↑ / Alt+↓ suben y bajan una tarea', async () => {
    const user = await setup();
    await addProject(user, 'Uno');
    await addProject(user, 'Zeta');
    expect(names()).toEqual(['Uno', 'Zeta']);
    const btn = () => rows()[rows().length - 1].querySelector('.side-item') as HTMLElement;
    btn().focus();
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(names()).toEqual(['Zeta', 'Uno']);
    expect(document.activeElement).toBe(rows()[0].querySelector('.side-item'));
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(names()).toEqual(['Uno', 'Zeta']);
    await user.click(screen.getByLabelText('Deshacer')); // un paso por movimiento
    expect(names()).toEqual(['Zeta', 'Uno']);
  }, 30_000);

  it('arrastrar una tarea a una carpeta y entre carpetas', async () => {
    const user = await setup();
    await user.click(screen.getByText('Carpeta'));
    await user.type(screen.getByLabelText('Nombre de la carpeta'), 'Clientes{Enter}');
    await addProject(user, 'Uno');
    await addProject(user, 'Dos');
    const folder = document.querySelector('.side-folder') as HTMLElement;
    const dos = () => rows().find((r) => r.querySelector('.side-name')!.textContent === 'Dos')!;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((f) => { f(0); return 1; });
    let under: Element = folder;
    document.elementFromPoint = () => under;
    // Arrastrar «Dos» sobre la carpeta la mete dentro.
    fireEvent(dos().querySelector('.side-item')!, new MouseEvent('pointerdown', { button: 0, clientX: 5, clientY: 5, bubbles: true }));
    act(() => { window.dispatchEvent(new MouseEvent('pointermove', { clientX: 60, clientY: 40, bubbles: true })); });
    expect(folder.classList.contains('drop-in')).toBe(true);
    expect(document.querySelector('.pm-ghost')?.textContent).toBe('Dos');
    act(() => { window.dispatchEvent(new MouseEvent('pointerup', { clientX: 60, clientY: 40, bubbles: true })); });
    expect(folder.classList.contains('drop-in')).toBe(false);
    expect(document.querySelector('.pm-ghost')).toBeNull();
    expect(dos().dataset.folder).not.toBe('');
    expect(folder.contains(dos())).toBe(true);
    // Arrastrar «Dos» antes de «Uno» (que está fuera) la saca de la carpeta y la deja antes.
    const uno = rows().find((r) => r.querySelector('.side-name')!.textContent === 'Uno')!;
    uno.getBoundingClientRect = () => ({ top: 100, height: 30, left: 0, right: 100, bottom: 130, width: 100, x: 0, y: 100, toJSON: () => ({}) });
    under = uno.querySelector('.side-item')!;
    fireEvent(dos().querySelector('.side-item')!, new MouseEvent('pointerdown', { button: 0, clientX: 5, clientY: 5, bubbles: true }));
    act(() => { window.dispatchEvent(new MouseEvent('pointermove', { clientX: 20, clientY: 105, bubbles: true })); });
    expect(uno.classList.contains('drop-before')).toBe(true);
    act(() => { window.dispatchEvent(new MouseEvent('pointerup', { clientX: 20, clientY: 105, bubbles: true })); });
    expect(dos().dataset.folder).toBe('');
    const order = names();
    expect(order.indexOf('Dos')).toBe(order.indexOf('Uno') - 1);
    // Sin mover el ratón, un clic sigue abriendo la tarea.
    await user.click(rows().find((r) => r.querySelector('.side-name')!.textContent === 'Uno')!.querySelector('.side-item')!);
    expect(screen.getByRole('heading', { name: 'Uno' })).toBeTruthy();
  }, 30_000);

  it('icono propio de cada tarea: se elige y se quita (vuelve el punto de color)', async () => {
    const user = await setup();
    await addProject(user, 'Mural');
    const row = () => rows().find((r) => r.querySelector('.side-name')!.textContent === 'Mural')!;
    expect(row().querySelector('.dot')).not.toBeNull();
    expect(within(row()).queryByLabelText('Icono de la tarea')).toBeNull(); // ya no está en la barra lateral
    await user.click(row().querySelector('.side-item')!);
    await user.click(screen.getByText('Personalizar tablero'));
    const grid = screen.getByRole('group', { name: 'Icono de la tarea' });
    expect(grid.querySelectorAll('.icon-cell').length).toBeGreaterThan(40);
    await user.click(grid.querySelector('.icon-cell')!);
    expect(row().querySelector('.proj-icon svg')).not.toBeNull();
    expect(row().querySelector('.dot')).toBeNull();
    await user.click(screen.getByText('Punto de color'));
    expect(row().querySelector('.dot')).not.toBeNull();
  }, 30_000);
});
