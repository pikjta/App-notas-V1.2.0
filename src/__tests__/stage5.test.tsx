// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';

afterEach(cleanup);

describe('Tabla PM · etapa 5', () => {
  it('pestañas de vista, página de la tarea con «Planificación», menú «/» y enlazado desde', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getByText('+ Añadir tarjeta'));
    await user.click(screen.getByRole('menuitem', { name: 'Tabla PM' }));
    const picker = screen.getByRole('dialog', { name: 'Nueva Tabla PM' });
    expect(within(picker).getByText(/Elige una plantilla para empezar/)).toBeTruthy();
    await user.click(within(picker).getByText('Encargo artístico'));
    const dlg = screen.getByRole('dialog', { name: /Tabla PM · Encargo artístico/ });

    // Pestañas por defecto.
    for (const n of ['Tabla', 'Cronología', 'Kanban']) expect(within(dlg).getByRole('tab', { name: n })).toBeTruthy();
    expect(within(dlg).getByRole('tab', { name: 'Tabla' }).getAttribute('aria-selected')).toBe('true');
    await user.click(within(dlg).getByRole('tab', { name: 'Kanban' }));
    expect(within(dlg).getByRole('tab', { name: 'Kanban' }).getAttribute('aria-selected')).toBe('true');
    await user.click(within(dlg).getByRole('tab', { name: 'Tabla' }));

    // Página de la tarea.
    await user.click(within(dlg).getByText('+ Nueva fila'));
    await user.keyboard('Retrato');
    await user.click(within(dlg).getAllByLabelText('Abrir página')[0]);
    const page = within(dlg).getByRole('complementary');
    for (const t of ['Página de la tarea', '[[ ]] Enlace', 'Copiar', 'Planificación', '◆ Hito', '⛓ Bloqueada por', 'Subtareas', 'Enlazado desde']) expect(within(page).getAllByText(new RegExp(t.replace(/[[\]]/g, '\\$&'))).length).toBeGreaterThan(0);
    expect(within(page).getByLabelText('Repetir')).toBeTruthy();
    expect(within(page).getByLabelText('Descargar como .md')).toBeTruthy();

    // «/» abre «Insertar bloque».
    await user.click(within(page).getByLabelText('Descripción de la fila'));
    await user.keyboard('/');
    const menu = within(page).getByRole('menu', { name: 'Insertar bloque' });
    for (const b of ['Título 1', 'Título 2', 'Título 3', 'Lista', 'Lista numerada', 'Tarea', 'Cita', 'Código', 'Separador', 'Enlace interno']) expect(within(menu).getByText(b)).toBeTruthy();
    await user.click(within(menu).getByText('Cita'));
    expect((within(page).getByLabelText('Descripción de la fila') as HTMLTextAreaElement).value).toBe('> ');
  }, 40_000);
});
