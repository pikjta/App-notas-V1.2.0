// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { typeNote } from './noteutil';
import App from '../App';

afterEach(cleanup);

describe('vistas: Hoy, Recordatorios, Diario e Inicio', () => {
  it('recordatorio en Hoy y Recordatorios; diario con la tarjeta de nota; widget; búsqueda', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });

    // Un recordatorio para dentro de 1 h en una tarea principal
    await user.click(screen.getByText('+ Tarea principal'));
    await user.type(screen.getByPlaceholderText('Nombre de la tarea principal'), 'Mural{Enter}');
    await user.click(screen.getByText('+ Añadir tarjeta'));
    await user.click(screen.getByRole('menuitem', { name: 'Recordatorio' }));
    await user.type(screen.getAllByPlaceholderText('Sin título').slice(-1)[0], 'Llamar al café');
    await user.click(screen.getByText('Elegir fecha'));
    await user.click(within(screen.getByRole('dialog', { name: 'Elegir fecha y hora' })).getByText('Hoy'));

    await user.click(Array.from(document.querySelectorAll('.side-item')).find((b) => b.querySelector('.side-name')?.textContent === 'Hoy')!);
    await screen.findByRole('heading', { name: 'Hoy' });
    const todayPanel = screen.getByText('Llamar al café').closest('.panel') as HTMLElement;
    expect(within(todayPanel).getByRole('heading').textContent).toContain('Hoy');

    await user.click(screen.getByRole('button', { name: /Recordatorios/ }));
    await screen.findByRole('heading', { name: 'Recordatorios' });
    await user.click(screen.getByLabelText('Activar o silenciar aviso'));
    await user.click(screen.getByRole('button', { name: 'Con aviso' }));
    expect(screen.getByText('No hay recordatorios con este filtro.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Silenciados' }));
    expect(screen.getByText('Llamar al café')).toBeTruthy();

    // Diario: crear con plantilla → es la tarjeta de nota (minibarra, color, papelera)
    await user.click(screen.getByRole('button', { name: /Diario/ }));
    await user.click(await screen.findByText('Crear con plantilla'));
    expect(screen.getByText('Nota del día', { selector: '.card-kind' })).toBeTruthy();
    expect(screen.getByLabelText('Color de la tarjeta')).toBeTruthy();
    // Se abre directamente en edición, con el cursor en la primera tarea.
    const ta = screen.getByRole('textbox', { name: 'Contenido de la nota' });
    expect(document.activeElement).toBe(ta);
    expect(screen.getByTitle('Negrita (⌘B)')).toBeTruthy();
    typeNote(ta, 'Pedir el andamio');
    expect(ta.querySelector('[data-k="task"]')!.textContent).toContain('Pedir el andamio');
    ta.blur();
    await user.click(screen.getByLabelText('Día anterior'));
    expect(screen.getByText('Sin nota este día')).toBeTruthy();
    await user.click(screen.getByText('Hoy', { selector: '.board-head button' }));
    expect(screen.getByLabelText('Color de la tarjeta')).toBeTruthy();

    // Búsqueda lleva a la nota del día
    await user.click(screen.getByText('Inicio'));
    await user.keyboard('{Control>}k{/Control}');
    await user.type(screen.getByRole('textbox', { name: 'Buscar' }), 'andamio');
    expect(within(screen.getByRole('listbox')).getByText(/Nota diaria/)).toBeTruthy();
    await user.keyboard('{Enter}');
    expect(await screen.findByText('Nota del día', { selector: '.card-kind' })).toBeTruthy();

    // Widget en el Inicio
    await user.click(screen.getByText('Inicio'));
    await user.click(screen.getByText('+ Añadir tarjeta'));
    await user.click(screen.getByRole('menuitem', { name: 'Widget · Tareas principales' }));
    expect(screen.getAllByText('Mural').length).toBeGreaterThan(1);
  }, 30_000);
});
