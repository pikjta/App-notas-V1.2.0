// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { pressNote, typeNote } from './noteutil';
import App from '../App';

describe('app (navegador, puente en memoria)', () => {
  it('flujo completo: tarea principal, notas, checklist, cifrado, bloqueo y recuperación', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    expect(screen.getByDisplayValue('Bienvenida')).toBeTruthy();

    // Nueva tarea principal
    await user.click(screen.getByText('+ Tarea principal'));
    await user.type(screen.getByPlaceholderText('Nombre de la tarea principal'), 'Mural Café Aurora{Enter}');
    await screen.findByRole('heading', { name: 'Mural Café Aurora' });

    // Nota con Markdown y tarea marcable
    await user.click(screen.getByText('+ Añadir tarjeta'));
    await user.click(screen.getByRole('menuitem', { name: 'Nota' }));
    const ed = screen.getByRole('textbox', { name: 'Contenido de la nota' });
    expect(ed.getAttribute('data-ph')).toContain('Nota vacía');
    typeNote(ed, 'Brief');
    await user.click(screen.getAllByRole('button', { name: 'Título' }).slice(-1)[0]);
    pressNote(ed, 'Enter');
    await user.click(screen.getAllByRole('button', { name: 'Casilla de tarea' }).slice(-1)[0]);
    typeNote(ed, 'Medir la pared');
    expect(ed.querySelector('[data-k="h2"]')!.textContent).toBe('Brief');
    expect(ed.textContent).not.toMatch(/[#\[\]]/); // sin sintaxis Markdown a la vista
    await user.click(ed.querySelector('.rn-mark[data-mark="task"]')!);
    expect(ed.querySelector('[data-k="task"]')!.hasAttribute('data-done')).toBe(true);

    // Checklist: Enter crea otra
    await user.click(screen.getByText('+ Añadir tarjeta'));
    await user.click(screen.getByRole('menuitem', { name: 'Checklist' }));
    const first = screen.getAllByPlaceholderText('Escribe una tarea…')[0];
    await user.type(first, 'Comprar pintura{Enter}Alquilar andamio');
    expect(screen.getAllByPlaceholderText('Escribe una tarea…')).toHaveLength(2);

    // Recordatorio y tabla
    await user.click(screen.getByText('+ Añadir tarjeta'));
    await user.click(screen.getByRole('menuitem', { name: 'Recordatorio' }));
    await user.click(screen.getByText('Elegir fecha'));
    await user.click(screen.getByText('Mañana'));
    await user.selectOptions(screen.getByLabelText('Hora'), '9');
    expect(screen.getByText(/Mañana a las 09:00/)).toBeTruthy();
    await user.click(screen.getByText('+ Añadir tarjeta'));
    await user.click(screen.getByRole('menuitem', { name: 'Tabla' }));
    await user.type(screen.getByLabelText('Fila 1, Columna 1'), 'Andamio{Enter}');

    // Papelera y deshacer
    await user.click(screen.getAllByLabelText('Eliminar tarjeta').slice(-1)[0]);
    expect(screen.queryByLabelText('Fila 1, Columna 1')).toBeNull();
    await user.click(screen.getByLabelText('Deshacer'));
    expect(screen.getByLabelText('Fila 1, Columna 1').textContent).toBe('Andamio');
    await user.click(screen.getAllByLabelText('Eliminar tarjeta').slice(-1)[0]);
    await user.click(screen.getByText('Papelera', { selector: '.side-name' }));
    await user.click(await screen.findByText('Restaurar'));
    await user.click(screen.getByText('Mural Café Aurora'));
    expect(screen.getByLabelText('Fila 1, Columna 1')).toBeTruthy();

    // Búsqueda ⌘K
    await user.keyboard('{Control>}k{/Control}');
    await user.type(screen.getByRole('textbox', { name: 'Buscar' }), 'andamio');
    expect(within(screen.getByRole('listbox')).getAllByRole('option').length).toBeGreaterThan(0);
    await user.keyboard('{Enter}');
    expect(screen.queryByRole('dialog', { name: 'Buscar' })).toBeNull();

    // Activar el cifrado
    await user.click(screen.getByText('Ajustes'));
    await user.click(screen.getByText('Seguridad', { selector: 'nav button' }));
    await user.click(screen.getByText('Activar…'));
    await user.click(screen.getByText('Continuar'));
    expect(screen.getByText('Continuar')).toHaveProperty('disabled', true);
    await user.click(within(screen.getByRole('dialog', { name: 'Ajustes' })).getByRole('checkbox'));
    await user.click(screen.getByText('Continuar'));
    await user.type(screen.getByPlaceholderText('Contraseña (mínimo 10 caracteres)'), 'la sierra al amanecer');
    await user.type(screen.getByPlaceholderText('Repite la contraseña'), 'la sierra al amanecer');
    await user.click(screen.getByText('Continuar'));
    const list = await screen.findByRole('list');
    const words = within(list).getAllByRole('listitem').map((li) => li.textContent!.replace(/^\d+/, ''));
    expect(words).toHaveLength(24);
    await user.click(screen.getByText('Ya las he guardado'));
    const labels = screen.getAllByText(/Palabra n\.º/);
    for (const l of labels) {
      const n = Number(l.textContent!.match(/\d+/)![0]);
      await user.type(within(l.closest('label')!).getByRole('textbox'), words[n - 1].toUpperCase());
    }
    await user.click(screen.getByText('Confirmar y cifrar'));
    await screen.findByRole('heading', { name: '✓ Cifrado activado' });

    // Bloquear: la interfaz se vacía
    await user.keyboard('{Escape}');
    await user.click(screen.getByLabelText('Bloquear ahora'));
    await screen.findByText('Tus datos están cifrados en este dispositivo.');
    expect(screen.queryByText('Mural Café Aurora')).toBeNull();

    await user.type(screen.getByLabelText('Contraseña'), 'mala{Enter}');
    await screen.findByText('Contraseña incorrecta.');

    // Recuperar con las palabras
    await user.click(screen.getByText(/Usar las 24 palabras/));
    await user.type(screen.getByLabelText('Palabras de recuperación'), words.join(' '));
    await user.type(screen.getByLabelText('Contraseña nueva'), 'otra frase muy larga');
    await user.type(screen.getByLabelText('Repite la contraseña nueva'), 'otra frase muy larga');
    await user.click(screen.getByText('Recuperar acceso'));
    await waitFor(() => expect(screen.getByText('Mural Café Aurora')).toBeTruthy());
  }, 30_000);
});
