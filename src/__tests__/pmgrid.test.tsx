// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

afterEach(cleanup);
const proxy = () => document.querySelector('.pm-scroll .grid-proxy') as HTMLTextAreaElement;
const td = (r: number, c: number) => document.querySelector(`.pm-grid td[data-r="${r}"][data-c="${c}"]`) as HTMLElement;
const txt = (r: number, c: number) => (td(r, c).querySelector('.pm-view') ?? td(r, c)).textContent;
const selected = () => document.querySelectorAll('.pm-grid td.sel').length;
const pop = () => document.querySelector('.pm-pop') as HTMLElement | null;

async function open() {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { name: 'Inicio' });
  await user.click(screen.getByText('+ Añadir tarjeta'));
  await user.click(screen.getByRole('menuitem', { name: 'Tabla PM' }));
  await user.click(within(screen.getByRole('dialog', { name: 'Nueva Tabla PM' })).getByText('Proyecto con fases'));
  const dlg = screen.getByRole('dialog', { name: /Tabla PM/ });
  await user.click(within(dlg).getByText('+ Nueva fila'));
  await user.keyboard('Bocetos{Enter}Mural{Enter}Entrega{Tab}');
  return { user, dlg };
}

describe('Tabla PM como hoja de cálculo (mejora 1.1.0, fase 3b)', () => {
  it('clic selecciona sin editar, doble clic edita, Esc cancela, escribir reemplaza, flechas y Mayús', async () => {
    const { user } = await open();
    expect(txt(0, 0)).toBe('Bocetos');
    await user.click(td(0, 0));
    expect(td(0, 0).classList.contains('cur')).toBe(true);
    expect(td(0, 0).querySelector('input')).toBeNull();
    await user.dblClick(td(0, 0));
    expect(td(0, 0).querySelector('input')).not.toBeNull();
    await user.keyboard('X{Escape}');
    expect(txt(0, 0)).toBe('Bocetos'); // Esc deja lo que había
    await user.keyboard('Nuevo{Tab}');
    expect(txt(0, 0)).toBe('Nuevo'); // escribir sobre la celda la reemplaza
    expect(td(0, 1).classList.contains('cur')).toBe(true);
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    expect(td(2, 1).classList.contains('cur')).toBe(true);
    await user.keyboard('{Shift>}{ArrowUp}{ArrowRight}{/Shift}');
    expect(selected()).toBe(4);
    await user.keyboard('{Control>}a{/Control}');
    expect(selected()).toBe(3 * 9);
  }, 30_000);

  it('los menús (estado…) se abren con doble clic, no con un clic', async () => {
    const { user } = await open();
    await user.click(td(0, 1));
    expect(pop()).toBeNull();
    await user.dblClick(td(0, 1));
    expect(pop()).not.toBeNull();
    expect(within(pop()!).getByText('Desarrollo')).toBeTruthy();
    await user.click(within(pop()!).getByText('Aprobado'));
    expect(txt(0, 1)).toContain('Aprobado');
    // Un clic en otra celda cierra el menú.
    await user.dblClick(td(1, 1));
    expect(pop()).not.toBeNull();
    await user.click(td(2, 0));
    expect(pop()).toBeNull();
  }, 30_000);

  it('copiar y pegar rangos: respeta los tipos, añade filas y es un solo paso de deshacer', async () => {
    const { user } = await open();
    // Dar valores: estado y horas de la primera fila.
    await user.dblClick(td(0, 1));
    await user.click(within(pop()!).getByText('Aprobado'));
    await user.click(td(0, 6));
    await user.keyboard('14{Tab}');
    // Copiar tarea, estado, progreso… hasta horas de la primera fila.
    fireEvent.mouseDown(td(0, 0), { button: 0 });
    fireEvent.mouseEnter(td(0, 6));
    fireEvent.mouseUp(td(0, 6));
    const setData = vi.fn();
    fireEvent.copy(proxy(), { clipboardData: { setData } });
    const copied = setData.mock.calls[0][1] as string;
    expect(copied.split('\t')[0]).toBe('Bocetos');
    expect(copied.split('\t')[1]).toBe('Aprobado');
    expect(copied.split('\t')[6]).toBe('14');
    // Pegar 2 filas desde la última (una existe, una nueva): estado por nombre, número con coma y texto.
    await user.click(td(2, 0));
    fireEvent.paste(proxy(), { clipboardData: { getData: () => 'Pintado\tEntregado\t\t\t\t\t6,5\r\nExtra\tNo existe\t\t\t\t\t3\r\n' } });
    expect(document.querySelectorAll('.pm-grid tbody tr[data-row]').length).toBe(4);
    expect(txt(2, 0)).toBe('Pintado');
    expect(txt(2, 1)).toContain('Entregado');
    expect(txt(2, 6)).toBe('6,5 h');
    expect(txt(3, 0)).toBe('Extra');
    expect(txt(3, 1)).not.toContain('No existe'); // un estado que no existe se ignora
    await user.click(screen.getByLabelText('Deshacer'));
    expect(document.querySelectorAll('.pm-grid tbody tr[data-row]').length).toBe(3);
    expect(txt(2, 0)).toBe('Entrega');
    // Una celda copiada rellena el rango; Supr vacía; cortar copia y vacía.
    fireEvent.mouseDown(td(0, 6), { button: 0 });
    fireEvent.mouseEnter(td(1, 6));
    fireEvent.mouseUp(td(1, 6));
    fireEvent.paste(proxy(), { clipboardData: { getData: () => '8' } });
    expect([txt(0, 6), txt(1, 6)]).toEqual(['8 h', '8 h']);
    await user.keyboard('{Delete}');
    expect([txt(0, 6), txt(1, 6)]).toEqual(['', '']);
    await user.click(td(0, 0));
    const cut = vi.fn();
    fireEvent.cut(proxy(), { clipboardData: { setData: cut } });
    expect(cut).toHaveBeenCalledWith('text/plain', 'Bocetos');
    expect(txt(0, 0)).toBe('');
  }, 30_000);

  it('autocompletado de las columnas de texto y Esc: primero suelta la selección, luego cierra la tabla', async () => {
    const { user, dlg } = await open();
    await user.click(td(2, 0));
    await user.keyboard('boc');
    const box = await screen.findByRole('listbox', { name: 'Sugerencias' });
    expect(within(box).getAllByRole('option').map((o) => o.textContent)).toEqual(['Bocetos']);
    await user.keyboard('{ArrowDown}{Tab}');
    expect(txt(2, 0)).toBe('Bocetos');
    await user.keyboard('{Escape}');
    expect(td(2, 1).classList.contains('cur')).toBe(false); // se soltó la selección
    expect(screen.queryByRole('dialog', { name: /Tabla PM/ })).not.toBeNull();
    await user.keyboard('{Escape}');
    expect(dlg.isConnected).toBe(false);
  }, 30_000);

  it('copiar toda la tabla lleva los nombres de columna; pegar más columnas de las que hay crea las que faltan', async () => {
    const { user, dlg } = await open();
    await user.click(td(0, 0));
    await user.keyboard('{Control>}a{/Control}');
    const setData = vi.fn();
    fireEvent.copy(proxy(), { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith('application/x-cuaderno-grid', 'header');
    const text = setData.mock.calls.find((c) => c[0] === 'text/plain')![1] as string;
    const names = [...dlg.querySelectorAll('th[data-col] .th-in .grow')].map((n) => n.textContent);
    expect(text.split('\n')[0].split('\t')).toEqual(names);
    expect(text.split('\n').length).toBe(4); // cabeceras + 3 filas
    // Pegar 3 columnas con cabeceras empezando en la última columna: se crean 2 columnas con esos nombres.
    const before = dlg.querySelectorAll('th[data-col]').length;
    await user.click(td(0, before - 1));
    fireEvent.paste(proxy(), { clipboardData: { getData: (t: string) => (t === 'text/plain' ? 'Uno\tCol Y\tCol Z\nx\t2\t3\ny\t4\t5' : t === 'application/x-cuaderno-grid' ? 'header' : '') } });
    expect(dlg.querySelectorAll('th[data-col]').length).toBe(before + 2);
    expect([...dlg.querySelectorAll('th[data-col] .th-in .grow')].slice(-2).map((n) => n.textContent)).toEqual(['Col Y', 'Col Z']);
    expect([txt(0, before), txt(1, before), txt(0, before + 1)]).toEqual(['2', '4', '3']); // columnas de número
    await user.click(screen.getByLabelText('Deshacer'));
    expect(dlg.querySelectorAll('th[data-col]').length).toBe(before);
  }, 30_000);
});
