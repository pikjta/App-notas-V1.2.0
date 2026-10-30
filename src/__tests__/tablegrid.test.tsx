// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

afterEach(cleanup);
const proxy = () => document.querySelector('.grid-proxy') as HTMLTextAreaElement;
const cell = (r: number, c: number) => document.querySelector(`[data-r="${r}"][data-c="${c}"]`) as HTMLElement;
const text = (r: number, c: number) => (cell(r, c).querySelector('.tbl-text') ?? cell(r, c)).textContent;
const selected = () => [...document.querySelectorAll('.tbl .sel')].length;
async function newTable() {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { name: 'Inicio' });
  await user.click(screen.getByText('+ Añadir tarjeta'));
  await user.click(screen.getByRole('menuitem', { name: 'Tabla' }));
  return user;
}

describe('Tabla tipo hoja de cálculo (mejora 1.1.0, fase 3)', () => {
  it('clic selecciona, doble clic edita, Enter confirma y baja, Esc cancela, escribir reemplaza', async () => {
    const user = await newTable();
    await user.click(cell(0, 0));
    expect(cell(0, 0).getAttribute('aria-selected')).toBe('true');
    expect(document.querySelector('.tbl input')).toBeNull(); // solo seleccionada, sin cuadro de texto
    await user.dblClick(cell(0, 0));
    expect(document.querySelector('.tbl-edit')).not.toBeNull();
    await user.keyboard('Uno{Enter}');
    expect(text(0, 0)).toBe('Uno');
    expect(cell(1, 0).classList.contains('cur')).toBe(true); // bajó una fila
    await user.keyboard('Dos');
    await user.keyboard('{Escape}');
    expect(text(1, 0)).toBe('');
    // Escribir sobre una celda con texto la reemplaza.
    await user.click(cell(0, 0));
    await user.keyboard('X{Tab}');
    expect(text(0, 0)).toBe('X');
    expect(cell(0, 1).classList.contains('cur')).toBe(true); // Tab fue a la derecha
    // F2 edita conservando el texto.
    await user.click(cell(0, 0));
    await user.keyboard('{F2}Y{Enter}');
    expect(text(0, 0)).toBe('XY');
  }, 30_000);

  it('flechas, Mayús para ampliar y Ctrl+A para toda la tabla (cabeceras incluidas)', async () => {
    const user = await newTable();
    await user.click(cell(0, 0));
    await user.keyboard('{ArrowRight}{ArrowDown}');
    expect(cell(1, 1).classList.contains('cur')).toBe(true);
    await user.keyboard('{ArrowDown}{ArrowRight}'); // en el borde se queda
    expect(cell(1, 1).classList.contains('cur')).toBe(true);
    await user.keyboard('{Shift>}{ArrowUp}{ArrowLeft}{/Shift}');
    expect(selected()).toBe(4);
    await user.keyboard('{Control>}a{/Control}');
    expect(selected()).toBe(6); // 2 cabeceras + 4 celdas
    // Arrastrar con el ratón elige un rango.
    fireEvent.mouseDown(cell(0, 0), { button: 0 });
    fireEvent.mouseEnter(cell(1, 1));
    fireEvent.mouseUp(cell(1, 1));
    expect(selected()).toBe(4);
  }, 30_000);

  it('copiar, cortar y pegar rangos como TSV; la tabla crece al pegar y un pegado es un paso de deshacer', async () => {
    const user = await newTable();
    await user.click(cell(0, 0));
    await user.keyboard('a{Tab}b{Enter}');
    await user.click(cell(1, 0));
    await user.keyboard('c{Tab}d{Tab}');
    // Toda la tabla: copia las cabeceras y las celdas.
    await user.keyboard('{Control>}a{/Control}');
    const setData = vi.fn();
    fireEvent.copy(proxy(), { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith('text/plain', 'Columna 1\tColumna 2\na\tb\nc\td');
    // Pegar 3 filas × 2 columnas desde la celda de la fila 2: crece la tabla.
    await user.click(cell(1, 0));
    fireEvent.paste(proxy(), { clipboardData: { getData: () => '1\t2\r\n3\t4\r\n5\t6\r\n' } });
    expect(document.querySelectorAll('.tbl tbody tr').length).toBe(4);
    expect([text(1, 0), text(1, 1), text(2, 0), text(3, 1)]).toEqual(['1', '2', '3', '6']);
    expect(selected()).toBe(6);
    await user.click(screen.getByLabelText('Deshacer'));
    expect(document.querySelectorAll('.tbl tbody tr').length).toBe(2);
    expect([text(0, 0), text(1, 0)]).toEqual(['a', 'c']);
    // Una sola celda copiada rellena el rango elegido.
    fireEvent.mouseDown(cell(0, 0), { button: 0 });
    fireEvent.mouseEnter(cell(1, 1));
    fireEvent.mouseUp(cell(1, 1));
    fireEvent.paste(proxy(), { clipboardData: { getData: () => 'z' } });
    expect([text(0, 0), text(0, 1), text(1, 0), text(1, 1)]).toEqual(['z', 'z', 'z', 'z']);
    // Cortar copia y vacía; Supr vacía.
    await user.click(cell(0, 0));
    const cut = vi.fn();
    fireEvent.cut(proxy(), { clipboardData: { setData: cut } });
    expect(cut).toHaveBeenCalledWith('text/plain', 'z');
    expect(text(0, 0)).toBe('');
    await user.click(cell(1, 1));
    await user.keyboard('{Delete}');
    expect(text(1, 1)).toBe('');
  }, 30_000);

  it('pegar sobre las cabeceras y celdas con comillas, tabuladores y saltos de línea', async () => {
    const user = await newTable();
    await user.click(cell(-1, 0));
    fireEvent.paste(proxy(), { clipboardData: { getData: () => 'Nombre\tEdad\tCiudad\nAna\t30\t"Madrid\nCentro"' } });
    expect(document.querySelectorAll('.tbl thead th:not(.tbl-add)').length).toBe(3);
    expect([text(-1, 0), text(-1, 2), text(0, 0), text(0, 2)]).toEqual(['Nombre', 'Ciudad', 'Ana', 'Madrid\nCentro']);
  }, 30_000);

  it('autocompletado con las palabras de la columna', async () => {
    const user = await newTable();
    await user.click(cell(0, 0));
    await user.keyboard('Andamio{Enter}Andén{Enter}');
    await user.click(cell(1, 0));
    await user.keyboard('and');
    const box = await screen.findByRole('listbox', { name: 'Sugerencias' });
    expect(within(box).getAllByRole('option').map((o) => o.textContent)).toEqual(['Andamio']);
    await user.keyboard('{ArrowDown}{Enter}');
    expect(text(1, 0)).toBe('Andamio');
    // También con el ratón.
    await user.click(cell(1, 1));
    await user.keyboard('x');
    expect(screen.queryByRole('listbox')).toBeNull(); // sin coincidencias en esa columna
    await user.keyboard('{Escape}');
    await user.click(cell(0, 0));
    await user.keyboard('{F2}{Escape}');
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(text(0, 0)).toBe('Andamio');
  }, 30_000);
});
