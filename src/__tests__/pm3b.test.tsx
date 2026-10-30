// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';

afterEach(cleanup);
const pop = () => document.querySelector('.pm-pop') as HTMLElement;

describe('Tabla PM · Fase 3b en la interfaz', () => {
  it('plantilla, página de fila, subtareas, dependencia, Kanban, archivar, CSV y guardar plantilla', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getByText('+ Añadir tarjeta'));
    await user.click(screen.getByRole('menuitem', { name: 'Tabla PM' }));
    const picker = screen.getByRole('dialog', { name: 'Nueva Tabla PM' });
    expect(within(picker).getByText('Contenidos y redes')).toBeTruthy();
    await user.click(within(picker).getByText('Encargo artístico'));
    const dlg = screen.getByRole('dialog', { name: /Tabla PM · Encargo artístico/ });
    expect(within(dlg).getByText('Anticipo pagado')).toBeTruthy();

    await user.click(within(dlg).getByText('+ Nueva fila'));
    await user.keyboard('Retrato de Lucía{Enter}Mural del café');

    // Página de la fila: descripción, subtareas, dependencia.
    await user.click(within(dlg).getAllByLabelText('Abrir página')[1]);
    const page = within(dlg).getByRole('complementary', { name: /Mural del café/ });
    await user.click(within(page).getByLabelText('Descripción de la fila'));
    await user.keyboard('Pared de **6 m**');
    await user.click(within(page).getByLabelText('Título de la fila'));
    expect(within(page).getByText('6 m').tagName).toBe('STRONG');
    await user.type(within(page).getByLabelText('Nueva subtarea'), 'Medir la pared{Enter}Comprar pintura{Enter}');
    await user.click(within(page).getAllByLabelText('Subtarea hecha')[0]);
    expect(within(page).getByText('1/2')).toBeTruthy();
    await user.click(within(page).getByText('+ Añadir dependencia'));
    await user.selectOptions(within(page).getByLabelText('Añadir dependencia'), 'Retrato de Lucía');
    expect(within(page).getByText(/Bloqueada por «Retrato de Lucía»/)).toBeTruthy();

    // Estado desde la página → queda en el historial.
    await user.click(within(page).getByLabelText('Estado'));
    await user.click(within(pop()).getByText('Bocetos'));
    expect(within(page).getAllByText('Bocetos').length).toBeGreaterThan(0);
    expect(within(page).getByText('Creación')).toBeTruthy();
    await user.click(within(page).getByLabelText('Cerrar página'));

    // Búsqueda en la tabla.
    await user.type(within(dlg).getByLabelText('Buscar en esta tabla'), 'lucia');
    expect(dlg.querySelector('.pm-toolbar')!.textContent).toContain('1 de 2 filas');
    await user.clear(within(dlg).getByLabelText('Buscar en esta tabla'));

    // Kanban por fase: la tarjeta está en «Creación».
    await user.click(within(dlg).getByRole('tab', { name: 'Kanban' }));
    const creation = [...dlg.querySelectorAll<HTMLElement>('[data-kcol]')].find((el) => el.textContent?.includes('Creación'))!;
    expect(within(creation).getByText('Mural del café')).toBeTruthy();
    expect(within(creation).getByText('⛔ Bloqueada')).toBeTruthy();
    await user.click(within(dlg).getByRole('tab', { name: 'Tabla' }));

    // Archivar desde el menú de la fila.
    await user.click(dlg.querySelectorAll('.pm-grip')[0] as HTMLElement);
    await user.click(within(pop()).getByText('Archivar'));
    expect(dlg.querySelector('.pm-toolbar')!.textContent).toContain('1 fila');
    await user.click(within(dlg).getByText(/^Archivadas · 1/));
    expect(dlg.querySelectorAll('tr.archived')).toHaveLength(1);
    await user.click(within(dlg).getByLabelText('Opciones de la tabla'));

    // Exportar CSV y volver a importarlo: se añaden 2 filas.
    await user.click(within(pop()).getByText(/Importar \/ exportar CSV/));
    await user.click(within(pop()).getByText('Descargar .csv'));
    await screen.findByText(/Exportadas 2 filas a CSV/);
    await user.click(within(dlg).getByLabelText('Opciones de la tabla'));
    await user.click(within(pop()).getByText(/Importar \/ exportar CSV/));
    await user.click(within(pop()).getByText('Elegir archivo .csv'));
    const imp = await screen.findByRole('dialog', { name: 'Importar CSV' });
    await user.click(within(imp).getByText('Importar 2 filas'));
    expect(dlg.querySelector('.pm-toolbar')!.textContent).toContain('4 filas');

    // Guardar como plantilla → aparece al crear otra tabla.
    await user.click(within(dlg).getByLabelText('Opciones de la tabla'));
    await user.click(within(pop()).getByText(/Guardar como plantilla/));
    const nameInput = within(pop()).getByLabelText('Nombre de la plantilla');
    await user.clear(nameInput); await user.type(nameInput, 'Mis encargos');
    await user.click(within(pop()).getByText('Guardar'));
    await user.click(within(dlg).getByLabelText('Cerrar'));
    await user.click(screen.getByText('+ Añadir tarjeta'));
    await user.click(screen.getByRole('menuitem', { name: 'Tabla PM' }));
    expect(within(screen.getByRole('dialog', { name: 'Nueva Tabla PM' })).getByText('Mis encargos')).toBeTruthy();
  }, 40_000);
});
