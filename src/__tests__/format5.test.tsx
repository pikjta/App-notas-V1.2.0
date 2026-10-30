// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { typeNote } from './noteutil';
import App from '../App';

afterEach(cleanup);
async function start(kind: 'Checklist' | 'Tabla' | 'Nota') {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { name: 'Inicio' });
  await user.click(screen.getByText('+ Añadir tarjeta'));
  await user.click(screen.getByRole('menuitem', { name: kind }));
  return user;
}

describe('Barra de formato (mejora 1.1.0, fase 5)', () => {
  it('Checklist: negrita, color y quitar formato en la tarea activa y en una selección', async () => {
    const user = await start('Checklist');
    await user.type(screen.getByPlaceholderText('Escribe una tarea…'), 'Uno{Enter}Dos');
    const boxes = () => [...document.querySelectorAll<HTMLTextAreaElement>('textarea.check-text')];
    const bar = () => within(screen.getAllByRole('toolbar', { name: 'Formato de las tareas' }).slice(-1)[0]);
    expect(bar().getByLabelText('Negrita')).toBeTruthy();
    await user.click(bar().getByLabelText('Negrita')); // la tarea activa es «Dos»
    expect(boxes()[1].style.fontWeight).toBe('700');
    expect(boxes()[0].style.fontWeight).toBe('');
    expect(bar().getByLabelText('Negrita').getAttribute('aria-pressed')).toBe('true');
    await user.click(bar().getByLabelText('Subrayado'));
    expect(boxes()[1].style.textDecoration).toBe('underline');
    // Selección de todas con Ctrl+A: el formato va a todas.
    await user.keyboard('{Control>}a{/Control}');
    await user.click(bar().getByLabelText('Cursiva'));
    expect(boxes().map((b) => b.style.fontStyle)).toEqual(['italic', 'italic']);
    // Color del texto con el selector libre.
    await user.click(bar().getByLabelText('Color del texto'));
    const dlg = screen.getByRole('dialog', { name: 'Color del texto' });
    const hex = within(dlg).getByLabelText('Código HEX');
    await user.clear(hex); await user.type(hex, 'D45A46');
    await user.click(within(dlg).getByText('Aceptar'));
    expect(boxes().map((b) => b.style.color)).toEqual(['rgb(212, 90, 70)', 'rgb(212, 90, 70)']);
    await user.click(bar().getByLabelText('Quitar formato'));
    expect(boxes().map((b) => b.style.color + b.style.fontStyle + b.style.fontWeight + b.style.textDecoration)).toEqual(['', '']);
  }, 30_000);

  it('Tabla: formato de una celda y de un rango (con las cabeceras), y se conserva al borrar una columna', async () => {
    const user = await start('Tabla');
    const cell = (r: number, c: number) => document.querySelector(`[data-r="${r}"][data-c="${c}"]`) as HTMLElement;
    const inner = (r: number, c: number) => cell(r, c).querySelector('.tbl-text') as HTMLElement;
    const bar = () => within(screen.getAllByRole('toolbar', { name: 'Formato de las celdas' }).slice(-1)[0]);
    await user.click(cell(0, 1));
    await user.click(bar().getByLabelText('Negrita'));
    expect(inner(0, 1).style.fontWeight).toBe('700');
    expect(inner(0, 0).style.fontWeight).toBe('');
    await user.click(bar().getByLabelText('Centrar'));
    expect(inner(0, 1).style.textAlign).toBe('center');
    // Toda la tabla (incluye cabeceras) tachada.
    await user.keyboard('{Control>}a{/Control}');
    await user.click(bar().getByLabelText('Tachado'));
    expect([inner(-1, 0), inner(1, 1)].map((e) => e.style.textDecoration)).toEqual(['line-through', 'line-through']);
    // La tecla sigue funcionando después de usar la barra (el foco vuelve a la tabla).
    await user.keyboard('{ArrowRight}');
    expect(cell(-1, 1).classList.contains('cur')).toBe(true);
    // Borrar la primera columna desplaza los formatos con su columna.
    await user.click(within(cell(-1, 0)).getByLabelText('Eliminar columna'));
    expect(inner(0, 0).style.fontWeight).toBe('700');
  }, 30_000);

  it('Tabla PM: formato en celdas de texto', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getByText('+ Añadir tarjeta'));
    await user.click(screen.getByRole('menuitem', { name: 'Tabla PM' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Nueva Tabla PM' })).getByText('Proyecto con fases'));
    const dlg = screen.getByRole('dialog', { name: /Tabla PM/ });
    await user.click(within(dlg).getByText('+ Nueva fila'));
    await user.keyboard('Bocetos{Tab}');
    const td = (r: number, c: number) => dlg.querySelector(`.pm-grid td[data-r="${r}"][data-c="${c}"]`) as HTMLElement;
    const bar = () => within(within(dlg).getByRole('toolbar', { name: 'Formato de las celdas' }));
    // Estado (pastilla): la barra no se aplica.
    expect((bar().getByLabelText('Negrita') as HTMLButtonElement).disabled).toBe(true);
    await user.click(td(0, 0));
    await user.click(bar().getByLabelText('Negrita'));
    await user.click(bar().getByLabelText('Cursiva'));
    const view = () => td(0, 0).querySelector('.pm-view') as HTMLElement;
    expect(view().style.fontWeight).toBe('700');
    expect(view().style.fontStyle).toBe('italic');
    await user.keyboard('{ArrowRight}{ArrowLeft}');
    expect(td(0, 0).classList.contains('cur')).toBe(true); // el foco volvió a la tabla
    await user.click(bar().getByLabelText('Quitar formato'));
    expect(view().getAttribute('style') ?? '').toBe('');
  }, 30_000);

  it('Nota: texto sin sintaxis y la barra aplica el formato a la selección', async () => {
    await start('Nota');
    const ed = screen.getAllByRole('textbox', { name: 'Contenido de la nota' }).slice(-1)[0];
    expect(screen.getAllByRole('button', { name: 'Título' }).slice(-1)[0]).toBeTruthy();
    typeNote(ed, 'Hola mundo');
    const t = ed.querySelector('[data-k="p"]')!.lastChild as Text;
    const r = document.createRange(); r.setStart(t, 5); r.setEnd(t, 10);
    const s = window.getSelection()!; s.removeAllRanges(); s.addRange(r);
    fireEvent.click(screen.getAllByTitle('Negrita (⌘B)').slice(-1)[0]);
    expect(ed.querySelector('strong')!.textContent).toBe('mundo');
    expect(ed.textContent).toBe('Hola mundo'); // no se ven asteriscos
  }, 30_000);
});
