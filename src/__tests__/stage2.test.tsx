// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';

afterEach(cleanup);

describe('etapa 2: barra lateral, carpetas y papeleras', () => {
  it('carpetas: crear, tarea dentro, mover a, plegar, eliminar conservando las tareas', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getByText('Carpeta'));
    await user.type(screen.getByPlaceholderText('Nombre de la carpeta'), 'Casa y vida{Enter}');
    expect(screen.getByText('Carpeta vacía')).toBeTruthy();
    await user.click(screen.getByLabelText('Nueva tarea principal aquí'));
    await user.type(screen.getByPlaceholderText('Nombre de la tarea principal'), 'Mudanza{Enter}');
    const body = document.querySelector('.folder-body') as HTMLElement;
    expect(within(body).getByText('Mudanza')).toBeTruthy();
    expect(screen.queryByText('Carpeta vacía')).toBeNull();
    // otra tarea suelta, y se mueve a la carpeta desde «Mover a»
    await user.click(screen.getByText('+ Tarea principal'));
    await user.type(screen.getByPlaceholderText('Nombre de la tarea principal'), 'Curso{Enter}');
    await user.click(screen.getAllByLabelText('Mover a una carpeta').slice(-1)[0]);
    await user.click(screen.getByRole('menuitem', { name: 'Casa y vida' }));
    expect(within(document.querySelector('.folder-body') as HTMLElement).getByText('Curso')).toBeTruthy();
    // plegar y desplegar
    await user.click(screen.getByLabelText('Plegar carpeta'));
    expect(document.querySelector('.folder-body')).toBeNull();
    await user.click(screen.getByLabelText('Desplegar carpeta'));
    // eliminar la carpeta: las tareas se conservan
    await user.click(screen.getByLabelText('Eliminar carpeta (las tareas se conservan)'));
    expect(document.querySelector('.side-folder')).toBeNull();
    const list = screen.getByRole('navigation', { name: 'Tareas principales' });
    expect(within(list).getByText('Mudanza')).toBeTruthy();
    expect(within(list).getByText('Curso')).toBeTruthy();
  }, 20_000);

  it('papelera del tablero y papelera general', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getByText('+ Tarea principal'));
    await user.type(screen.getByPlaceholderText('Nombre de la tarea principal'), 'Mural{Enter}');
    expect(screen.getByText('Tablero vacío')).toBeTruthy();
    await user.click(screen.getByText('Añadir primera tarjeta'));
    await user.click(screen.getByLabelText('Eliminar tarjeta'));
    expect(screen.getByText('Tarjeta movida a la papelera')).toBeTruthy();
    await user.click(screen.getByLabelText('Papelera del tablero'));
    const dlg = screen.getByRole('dialog', { name: 'Papelera de «Mural»' });
    await user.click(within(dlg).getByText('Restaurar'));
    expect(within(dlg).getByText('No hay tarjetas eliminadas en este tablero.')).toBeTruthy();
    await user.click(within(dlg).getByText('Cerrar'));
    // tarea principal a la papelera desde la barra; vista Papelera
    await user.click(screen.getByLabelText('Mover a la papelera'));
    await user.click(screen.getByText('Papelera', { selector: '.side-name' }));
    expect(screen.getByText('Tareas principales · 1')).toBeTruthy();
    expect(screen.getByText('No hay tarjetas en la papelera.')).toBeTruthy();
    await user.click(screen.getByText('Vaciar papelera'));
    await user.click(screen.getByText('Vaciar todo'));
    expect(screen.getByText('No hay tareas principales en la papelera.')).toBeTruthy();
  }, 20_000);
});
