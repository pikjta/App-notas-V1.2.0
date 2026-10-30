// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';

afterEach(cleanup);

describe('Calendario', () => {
  it('crear y editar un evento, cambiar de vista, exportar e importar .ics y buscarlo', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getByText('Calendario'));
    // Los calendarios se eligen en el desplegable de la barra inferior.
    await user.click(screen.getByRole('button', { name: /Calendarios/ }));
    expect(screen.getByLabelText('Mostrar Cuaderno')).toBeTruthy();
    expect(screen.getByLabelText('Mostrar Festivos')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Calendarios/ }));
    expect(screen.queryByLabelText('Mostrar Cuaderno')).toBeNull();

    await user.click(screen.getByText('+ Añadir recordatorio'));
    const dlg = screen.getByRole('dialog', { name: 'Nota o recordatorio' });
    await user.type(within(dlg).getByLabelText('Título'), 'Presentación al cliente');
    await user.click(within(dlg).getByText('Guardar'));
    expect(screen.queryByRole('dialog', { name: 'Nota o recordatorio' })).toBeNull();
    expect(screen.getAllByText(/Presentación al cliente/).length).toBeGreaterThan(0);

    for (const v of ['Semana', 'Día', 'Agenda', 'Mes']) await user.click(screen.getByRole('button', { name: v }));
    await user.click(screen.getAllByText(/Presentación al cliente/)[0]);
    const edit = screen.getByRole('dialog', { name: 'Editar nota o recordatorio' });
    const t = within(edit).getByLabelText('Título');
    await user.clear(t); await user.type(t, 'Presentación de bocetos');
    await user.click(within(edit).getByText('Guardar'));
    expect(screen.getAllByText(/Presentación de bocetos/).length).toBeGreaterThan(0);

    // Exportar «Cuaderno» e importarlo como calendario nuevo.
    await user.click(screen.getByRole('button', { name: 'Ajustes del calendario' }));
    await user.click(screen.getByText('Exportar calendarios visibles'));
    await screen.findByText(/Exportados \d+ eventos/);
    await user.click(screen.getByText('Importar un archivo .ics'));
    await screen.findByText(/Importados \d+ eventos en «Cuaderno»/);
    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    await user.click(screen.getByRole('button', { name: /Calendarios/ }));
    expect(screen.getAllByLabelText('Mostrar Cuaderno')).toHaveLength(2);

    // Ocultar un calendario quita sus eventos.
    const before = screen.getAllByText(/Presentación de bocetos/).length;
    await user.click(screen.getAllByLabelText('Mostrar Cuaderno')[1]);
    expect(screen.getAllByText(/Presentación de bocetos/).length).toBe(before - 1);

    // Búsqueda ⌘K → abre el evento.
    await user.keyboard('{Control>}k{/Control}');
    await user.type(screen.getByRole('textbox', { name: 'Buscar' }), 'bocetos');
    await user.keyboard('{Enter}');
    expect(await screen.findByRole('dialog', { name: 'Editar nota o recordatorio' })).toBeTruthy();
  }, 30_000);
});
