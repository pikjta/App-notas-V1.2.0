// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from '../App';

afterEach(cleanup);

const clip = (text = '') => {
  const store: Record<string, string> = { 'text/plain': text };
  return { getData: (k: string) => store[k] ?? '', setData: (k: string, v: string) => { store[k] = v; }, store };
};

describe('Mejoras 1.1.0', () => {
  it('la Papelera está justo debajo de Diario, en Vistas', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    const nav = screen.getByRole('navigation', { name: 'Vistas' });
    const names = [...nav.querySelectorAll('.side-name')].map((e) => e.textContent);
    expect(names.indexOf('Papelera')).toBe(names.indexOf('Diario') + 1);
  });

  it('Tabla PM: la vista previa muestra las 3 primeras columnas', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getByText('+ Añadir tarjeta'));
    await user.click(screen.getByRole('menuitem', { name: 'Tabla PM' }));
    await user.click(screen.getByText('Proyecto con fases'));
    await user.keyboard('{Escape}');
    const card = document.querySelector('.pm-compact') as HTMLElement;
    expect(card).toBeTruthy();
    await user.click(screen.getByText('Abrir tabla'));
    await user.click(screen.getByText('+ Nueva fila'));
    await user.keyboard('Bocetos{Tab}');
    await user.keyboard('{Escape}{Escape}');
    const row = document.querySelector('.pm-mini-row:not(.pm-mini-head)') as HTMLElement;
    expect(row.querySelectorAll('.pm-mini-cell').length).toBe(3);
    expect(row.textContent).toContain('Bocetos');
    // La vista previa rotula las columnas.
    const head = document.querySelector('.pm-mini-head') as HTMLElement;
    expect(head.querySelectorAll('.pm-mini-cell').length).toBe(3);
    expect(head.textContent).toContain('Tarea');
    expect(head.textContent).toContain('Estado');
  }, 30_000);

  const newChecklist = async (user: ReturnType<typeof userEvent.setup>) => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getByText('+ Tarea principal'));
    await user.type(screen.getByPlaceholderText('Nombre de la tarea principal'), 'Mural{Enter}');
    await user.click(screen.getByText('+ Añadir tarjeta'));
    await user.click(screen.getByRole('menuitem', { name: 'Checklist' }));
  };
  const boxes = () => screen.getAllByPlaceholderText('Escribe una tarea…') as HTMLTextAreaElement[];
  const proxy = () => document.querySelector('.check-proxy') as HTMLTextAreaElement;
  const pad = (b: HTMLElement) => parseInt((b.closest('.check-row') as HTMLElement).style.paddingLeft || '0', 10);

  it('Checklist: botón (+), sin botón inferior, flechas, Ctrl+A, copiar y pegar', async () => {
    const user = userEvent.setup();
    await newChecklist(user);
    expect(screen.queryByText('+ Añadir subtarea')).toBeNull();
    await user.type(screen.getByPlaceholderText('Escribe una tarea…'), 'Bocetos{Enter}Pintura');
    await user.click(screen.getAllByLabelText('Añadir subtarea')[0]);
    await user.keyboard('Logo');
    expect(boxes().map((b) => b.value)).toEqual(['Bocetos', 'Logo', 'Pintura']);
    // El texto largo es un cuadro de texto (se parte en líneas), no una sola línea.
    expect(boxes()[0].tagName).toBe('TEXTAREA');
    // Flechas: ↓ y ↑.
    await user.click(boxes()[0]);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(boxes()[1]);
    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(boxes()[2]);
    await user.keyboard('{ArrowDown}'); // en la última no pasa nada
    expect(document.activeElement).toBe(boxes()[2]);
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(document.activeElement).toBe(boxes()[0]);
    // Ctrl+A selecciona toda la lista; el cuadro oculto lleva la lista en Markdown, ya seleccionada.
    await user.keyboard('{Control>}a{/Control}');
    expect(document.querySelectorAll('.check-row.selected').length).toBe(3);
    expect(document.activeElement).toBe(proxy());
    expect(proxy().value).toBe('- [ ] Bocetos\n  - [ ] Logo\n- [ ] Pintura');
    expect(proxy().selectionStart).toBe(0);
    expect(proxy().selectionEnd).toBe(proxy().value.length);
    // Pegar con todo seleccionado reemplaza la lista.
    fireEvent.paste(proxy(), { clipboardData: clip('- [x] A\n  - [ ] B\n- [ ] C') });
    expect(boxes().map((b) => b.value)).toEqual(['A', 'B', 'C']);
    expect(document.querySelectorAll('.check-row.selected').length).toBe(0);
  }, 30_000);

  it('Checklist: la viñeta de la subtarea queda más a la derecha y hay sub-subtareas', async () => {
    const user = userEvent.setup();
    await newChecklist(user);
    await user.type(screen.getByPlaceholderText('Escribe una tarea…'), 'Mural');
    await user.click(screen.getAllByLabelText('Añadir subtarea')[0]);
    await user.keyboard('Bocetos');
    // El (+) de la subtarea añade una sub-subtarea.
    await user.click(screen.getAllByLabelText('Añadir subtarea')[1]);
    await user.keyboard('Logo');
    expect(boxes().map((b) => b.value)).toEqual(['Mural', 'Bocetos', 'Logo']);
    const [p0, p1, p2] = boxes().map(pad);
    expect(p0).toBeLessThan(p1);
    expect(p1).toBeLessThan(p2);
    // Las tres filas tienen la misma estructura (plegar, +, casilla), así que la casilla de cada nivel está más a la derecha.
    for (const r of document.querySelectorAll('.check-row')) {
      const [a, b, c] = [...r.children];
      expect([a.classList.contains('fold'), b.classList.contains('fold'), (c as HTMLInputElement).type]).toEqual([true, true, 'checkbox']);
    }
    // Una sub-subtarea hecha completa la cadena: la subtarea y la tarea quedan marcadas.
    await user.click(screen.getAllByLabelText('Hecha')[2]);
    expect((screen.getAllByLabelText('Hecha') as HTMLInputElement[]).map((c) => c.checked)).toEqual([true, true, true]);
    // Marcar la tarea principal marca y desmarca todo lo que cuelga de ella.
    await user.click(screen.getAllByLabelText('Hecha')[0]);
    expect((screen.getAllByLabelText('Hecha') as HTMLInputElement[]).map((c) => c.checked)).toEqual([false, false, false]);
    // Plegar la tarea oculta las dos subtareas.
    await user.click(screen.getAllByLabelText('Plegar subtareas')[0]);
    expect(boxes().map((b) => b.value)).toEqual(['Mural']);
    await user.click(screen.getByLabelText('Desplegar subtareas'));
    // Tab y Mayús+Tab cambian el nivel con todo lo que cuelga.
    await user.click(boxes()[1]);
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(boxes().map(pad)).toEqual([0, 0, 24]);
    await user.keyboard('{Tab}');
    expect(boxes().map(pad)).toEqual([0, 24, 48]);
    // Hay un nivel máximo (5 niveles): la última tarea no tiene (+).
    await user.click(screen.getAllByLabelText('Añadir subtarea')[2]);
    await user.keyboard('N3');
    await user.click(screen.getAllByLabelText('Añadir subtarea')[3]);
    await user.keyboard('N4');
    expect(boxes().map(pad)).toEqual([0, 24, 48, 72, 96]);
    expect(screen.getAllByLabelText('Añadir subtarea').length).toBe(4); // la de nivel máximo no tiene (+)
  }, 30_000);

  it('Checklist: selección con el ratón (arrastrar y Mayús+clic), copiar, cortar y borrar', async () => {
    const user = userEvent.setup();
    await newChecklist(user);
    await user.type(screen.getByPlaceholderText('Escribe una tarea…'), 'Uno{Enter}Dos{Enter}Tres{Enter}Cuatro');
    const rows = () => [...document.querySelectorAll<HTMLElement>('.check-row')];
    const selectedTexts = () => rows().filter((r) => r.classList.contains('selected')).map((r) => (r.querySelector('textarea') as HTMLTextAreaElement).value);
    // Arrastrar de la fila 2 a la 3 selecciona esas dos (el texto de una sola fila se sigue seleccionando normal).
    fireEvent.mouseDown(boxes()[1], { button: 0 });
    fireEvent.mouseEnter(rows()[1]);
    expect(selectedTexts()).toEqual([]); // dentro de la misma fila: selección de texto normal
    fireEvent.mouseEnter(rows()[2]);
    expect(selectedTexts()).toEqual(['Dos', 'Tres']);
    expect((document.querySelector('.check') as HTMLElement).className).toContain('ranging');
    fireEvent.mouseUp(rows()[2]);
    expect((document.querySelector('.check') as HTMLElement).className).not.toContain('ranging');
    expect(selectedTexts()).toEqual(['Dos', 'Tres']); // sigue seleccionado al soltar
    expect(proxy().value).toBe('- [ ] Dos\n- [ ] Tres');
    expect(document.activeElement).toBe(proxy());
    // Volver sobre la primera fila deja solo esa; arrastrar hacia arriba también funciona.
    fireEvent.mouseDown(boxes()[3], { button: 0 });
    fireEvent.mouseEnter(rows()[2]);
    fireEvent.mouseEnter(rows()[1]);
    expect(selectedTexts()).toEqual(['Dos', 'Tres', 'Cuatro']);
    fireEvent.mouseEnter(rows()[3]);
    expect(selectedTexts()).toEqual(['Cuatro']);
    fireEvent.mouseUp(rows()[3]);
    // Mayús+clic amplía desde la última tarea usada.
    await user.click(boxes()[0]);
    fireEvent.mouseDown(boxes()[2], { button: 0, shiftKey: true });
    expect(selectedTexts()).toEqual(['Uno', 'Dos', 'Tres']);
    // Mayús+↓ amplía una fila más y Mayús+↑ la quita.
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
    expect(selectedTexts()).toEqual(['Uno', 'Dos', 'Tres', 'Cuatro']);
    await user.keyboard('{Shift>}{ArrowUp}{ArrowUp}{/Shift}');
    expect(selectedTexts()).toEqual(['Uno', 'Dos']);
    // Cortar (Ctrl+X) copia al portapapeles y quita las tareas.
    fireEvent.cut(proxy());
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect(boxes().map((b) => b.value)).toEqual(['Tres', 'Cuatro']);
    // Borrar con Supr quita lo seleccionado; si se borra todo queda una tarea vacía.
    await user.click(boxes()[0]);
    await user.keyboard('{Control>}a{/Control}{Delete}');
    expect(boxes().map((b) => b.value)).toEqual(['']);
    // Pulsar fuera de la selección la termina; una letra vuelve a escribirse en la tarea.
    await user.type(boxes()[0], 'Hola{Enter}Adiós');
    await user.keyboard('{Control>}a{/Control}');
    expect(selectedTexts().length).toBe(2);
    await user.keyboard('x');
    expect(selectedTexts().length).toBe(0);
    expect(boxes().map((b) => b.value)).toEqual(['Hola', 'Adiósx']);
  }, 30_000);

  it('Checklist: lo seleccionado con el ratón se puede copiar (Ctrl+C) aunque el foco se pierda al soltar', async () => {
    const user = userEvent.setup();
    await newChecklist(user);
    await user.type(screen.getByPlaceholderText('Escribe una tarea…'), 'Uno{Enter}Dos{Enter}Tres');
    const rows = () => [...document.querySelectorAll<HTMLElement>('.check-row')];
    fireEvent.mouseDown(boxes()[0], { button: 0 });
    fireEvent.mouseEnter(rows()[1]);
    (document.activeElement as HTMLElement).blur(); // el navegador deja el foco fuera
    fireEvent.mouseUp(rows()[1]);
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
    expect(document.activeElement).toBe(proxy());
    const setData = vi.fn();
    fireEvent.copy(document.activeElement as HTMLElement, { clipboardData: { setData } });
    expect(setData).toHaveBeenCalledWith('text/plain', '- [ ] Uno\n- [ ] Dos');
  }, 30_000);
});

describe('Mejoras 1.1.0 · color e iconos', () => {
  it('el botón de color abre el selector libre y se elige un HEX', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getByText('+ Añadir tarjeta'));
    await user.click(screen.getByRole('menuitem', { name: 'Nota' }));
    const btn = (() => { const l = screen.getAllByLabelText('Color de la tarjeta'); return l[l.length - 1]; })();
    const cardOf = () => btn.closest('.card') as HTMLElement;
    await user.click(btn);
    const dlg = screen.getByRole('dialog', { name: 'Color de la tarjeta' });
    // Ya no hay colores predefinidos ni etiquetas de color.
    expect(screen.queryByTitle('Mantequilla')).toBeNull();
    const hex = screen.getByLabelText('Código HEX') as HTMLInputElement;
    await user.clear(hex);
    await user.type(hex, 'd45a46');
    expect((screen.getByLabelText('Rojo') as HTMLInputElement).value).toBe('212');
    expect((screen.getByLabelText('Tono') as HTMLInputElement).value).toBe('8');
    await user.click(screen.getByText('Aceptar'));
    expect(screen.queryByRole('dialog', { name: 'Color de la tarjeta' })).toBeNull();
    expect(dlg.isConnected).toBe(false);
    expect(cardOf().style.getPropertyValue('--card-bg').toUpperCase()).toBe('#D45A46');
    // Automático vuelve al color del tablero.
    await user.click(btn);
    await user.click(screen.getByText('Automático'));
    expect(cardOf().style.getPropertyValue('--card-bg').toUpperCase()).not.toBe('#D45A46');
  }, 30_000);

  it('Personalizar barra: 5 estilos de icono y el icono del botón de color (paleta por defecto)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getByLabelText('Personalizar barra'));
    expect(document.querySelectorAll('.icon-style').length).toBe(5);
    expect(screen.getByLabelText('Icono de color: Paleta').getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByLabelText('Icono de color: Gota'));
    expect(screen.getByLabelText('Icono de color: Gota').getAttribute('aria-pressed')).toBe('true');
    await user.click(screen.getByLabelText('Iconos Relleno'));
    expect(screen.getByLabelText('Iconos Relleno').getAttribute('aria-pressed')).toBe('true');
  }, 30_000);

  it('Iconos de la barra: se cambian (Papelera, Diario…) y se restablecen', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    const trashSvg = () => Array.from(document.querySelectorAll('.side-item')).find((b) => b.textContent?.includes('Papelera'))!.querySelector('.vi svg')!.innerHTML;
    const before = trashSvg();
    await user.click(screen.getByLabelText('Personalizar barra'));
    expect(document.querySelectorAll('.view-icon').length).toBe(7);
    await user.click(screen.getByLabelText(/^Icono de Papelera/));
    expect(document.querySelectorAll('.icon-cell').length).toBeGreaterThan(40);
    await user.click(screen.getByRole('group', { name: 'Elegir icono de Papelera' }).querySelector('.icon-cell:not(.on)')!);
    expect(trashSvg()).not.toBe(before);
    await user.click(screen.getByText('Restablecer'));
    expect(trashSvg()).toBe(before);
  }, 30_000);
});

describe('Mejoras 1.1.0 · selector de color (correcciones)', () => {
  it('el cuadro y la barra de tono responden al primer clic, sin tocar antes ningún número', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getByText('+ Añadir tarjeta'));
    await user.click(screen.getByRole('menuitem', { name: 'Nota' }));
    const l = screen.getAllByLabelText('Color de la tarjeta');
    await user.click(l[l.length - 1]);
    const rect = (w: number, h: number) => ({ left: 0, top: 0, width: w, height: h, right: w, bottom: h, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    const area = screen.getByTestId('cp-area');
    const hue = screen.getByTestId('cp-hue');
    area.getBoundingClientRect = () => rect(256, 256);
    hue.getBoundingClientRect = () => rect(22, 256);
    const val = (name: string) => (screen.getByLabelText(name) as HTMLInputElement).value;
    // jsdom no trae PointerEvent: se usa un MouseEvent con el nombre del evento de puntero.
    const ptr = (target: EventTarget, type: string, x: number, y: number) => act(() => { target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true, button: 0 })); });
    // Primer gesto: clic en el cuadro.
    ptr(area, 'pointerdown', 128, 64);
    expect(val('Saturación')).toBe('50');
    expect(val('Brillo')).toBe('75');
    // Arrastrar fuera del cuadro sigue al cursor (se queda en el borde).
    ptr(window, 'pointermove', 400, -40);
    expect(val('Saturación')).toBe('100');
    expect(val('Brillo')).toBe('100');
    ptr(window, 'pointerup', 0, 0);
    // Barra de tono.
    ptr(hue, 'pointerdown', 10, 128);
    expect(val('Tono')).toBe('180');
    ptr(window, 'pointerup', 0, 0);
    // HSB y RGB están en dos columnas, cada una con sus tres campos.
    const groups = screen.getAllByRole('group').filter((g) => ['HSB', 'RGB'].includes(g.getAttribute('aria-label') ?? ''));
    expect(groups.map((g) => g.querySelectorAll('input').length)).toEqual([3, 3]);
    expect(groups.map((g) => [...g.querySelectorAll('.cp-num span')].map((x) => x.textContent).join(''))).toEqual(['HSB', 'RGB']);
  }, 30_000);
  it('Selector de color: icono en cada parámetro (H, S, B y un punto rojo, verde y azul)', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getAllByLabelText('Color de la tarjeta')[0]);
    const dlg = screen.getByRole('dialog', { name: 'Color de la tarjeta' });
    expect(dlg.querySelectorAll('.cp-num .cp-glyph svg').length).toBe(6);
    expect(dlg.querySelector('[aria-label="RGB"]')!.querySelectorAll('circle[fill]').length).toBe(3);
  }, 30_000);
});
