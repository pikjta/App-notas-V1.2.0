// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';

afterEach(cleanup);

describe('Tabla PM en la interfaz', () => {
  it('crear, abrir, filas con teclado, estado y progreso, columnas, filtros, orden, totales, etiquetas globales y deshacer', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getByText('+ Añadir tarjeta'));
    await user.click(screen.getByRole('menuitem', { name: 'Tabla PM' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Nueva Tabla PM' })).getByText('Proyecto con fases'));
    const dlg = screen.getByRole('dialog', { name: /Tabla PM/ });

    // Filas con teclado: Enter crea la siguiente.
    await user.click(within(dlg).getByText('+ Nueva fila'));
    await user.keyboard('Bocetos{Enter}Pintado del mural{Enter}Entrega{Tab}');
    const tareas = () => within(dlg).getAllByLabelText('Tarea');
    expect(tareas().map((t) => t.textContent)).toEqual(['Bocetos', 'Pintado del mural', 'Entrega']);
    await user.click(tareas()[2]); await user.keyboard('{ArrowUp}');
    expect(document.querySelector('td.cur')).toBe(tareas()[1].closest('td'));

    // Estado agrupado por fases → progreso de la fila y de la tabla.
    await user.dblClick(within(dlg).getAllByLabelText('Estado')[1]);
    const pop = document.querySelector('.pm-pop') as HTMLElement;
    expect(within(pop).getByText('Desarrollo')).toBeTruthy();
    await user.click(within(pop).getByText('Aprobado'));
    expect(within(dlg).getByText('82%')).toBeTruthy();
    expect(within(dlg).getAllByText('27%').length).toBeGreaterThan(0);

    // Números y totales.
    const horas = within(dlg).getAllByLabelText('Horas');
    await user.type(horas[0], '14'); await user.type(horas[1], '6,5');
    expect(within(dlg).getByText('20,5 h')).toBeTruthy();

    // Etiqueta global creada desde la celda.
    await user.dblClick(within(dlg).getAllByLabelText('Etiquetas')[0]);
    await user.type(within(document.querySelector('.pm-pop') as HTMLElement).getByLabelText('Buscar o crear'), 'Exterior{Enter}');
    expect(within(dlg).getAllByText('Exterior').length).toBeGreaterThan(0);
    await user.keyboard('{Escape}');

    // Filtro: solo «Pintado del mural» está aprobado.
    await user.click(within(dlg).getByText(/^Filtros/));
    await user.click(screen.getByText('+ Añadir filtro'));
    const fm = document.querySelector('.pm-pop') as HTMLElement;
    await user.selectOptions(within(fm).getByLabelText('Columna'), 'Estado');
    await user.selectOptions(within(fm).getByLabelText('Condición'), 'phase');
    await user.selectOptions(within(fm).getByLabelText('Valor'), 'Verificación');
    expect(within(dlg).getByText('1 de 3 filas')).toBeTruthy();
    await user.click(within(fm).getByText('Quitar todos'));
    expect(dlg.querySelector('.pm-toolbar')!.textContent).toContain('3 filas');

    // Ocultar y mostrar una columna; añadir una nueva.
    await user.click(within(dlg).getByLabelText('Opciones de la tabla'));
    await user.click(within(document.querySelector('.pm-pop') as HTMLElement).getByText(/Propiedades/));
    await user.click(within(document.querySelector('.pm-pop') as HTMLElement).getByLabelText(/Presupuesto/));
    expect(dlg.querySelector('thead')!.textContent).not.toContain('Presupuesto');
    await user.keyboard('{Escape}');
    await user.click(within(dlg).getByText('+ Nueva columna'));
    await user.click(within(document.querySelector('.pm-pop') as HTMLElement).getByText(/Casilla/));
    expect(within(dlg).getAllByLabelText('Casilla').length).toBe(3);

    // Deshacer devuelve la columna añadida.
    await user.click(dlg.querySelector('.pm-head') as HTMLElement);
    await user.keyboard('{Control>}z{/Control}');
    expect(within(dlg).queryAllByLabelText('Casilla')).toHaveLength(0);

    // Cerrar: la vista compacta muestra el progreso.
    await user.click(within(dlg).getByLabelText('Cerrar'));
    expect(screen.getByText('3 tareas')).toBeTruthy();
    expect(screen.getAllByText('27%').length).toBeGreaterThan(0);
  }, 30_000);
});
