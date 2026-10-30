// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';

afterEach(cleanup);
const pop = () => document.querySelector('.pm-pop') as HTMLElement;

describe('Tabla PM · Fase 3c en la interfaz', () => {
  it('cronómetro con indicador, formato condicional, recurrente, cronología y calendario', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getByText('+ Añadir tarjeta'));
    await user.click(screen.getByRole('menuitem', { name: 'Tabla PM' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Nueva Tabla PM' })).getByText('Proyecto con fases'));
    const dlg = screen.getByRole('dialog', { name: /Tabla PM/ });
    await user.click(within(dlg).getByText('+ Nueva fila'));
    await user.keyboard('Factura mensual{Enter}Bocetos');

    // Columna de cronómetro: arrancar en una fila y luego en otra (solo uno en marcha).
    await user.click(within(dlg).getByText('+ Nueva columna'));
    await user.click(within(pop()).getByText(/^.{0,3}Tiempo/));
    await user.click(within(dlg).getAllByLabelText('Iniciar Tiempo')[0]);
    expect(document.querySelector('.timer-badge')!.textContent).toContain('Factura mensual');
    await user.click(within(dlg).getAllByLabelText('Iniciar Tiempo')[0]); // la segunda fila
    expect(within(dlg).getAllByLabelText('Parar Tiempo')).toHaveLength(1);
    expect(document.querySelector('.timer-badge')!.textContent).toContain('Bocetos');
    await user.click(within(dlg).getByLabelText('Parar Tiempo'));
    expect(document.querySelector('.timer-badge')).toBeNull();

    // Formato condicional: las facturadas en verde.
    await user.click(within(dlg).getAllByLabelText('Facturado')[1]);
    await user.click(within(dlg).getByLabelText('Opciones de la tabla'));
    await user.click(within(pop()).getByText(/Formato condicional/));
    await user.click(within(pop()).getByText('+ Añadir regla'));
    await user.selectOptions(within(pop()).getByLabelText('Columna'), 'Facturado');
    await user.click(within(pop()).getByLabelText('Color green'));
    expect(dlg.querySelectorAll('tr.ruled')).toHaveLength(1);
    await user.keyboard('{Escape}');

    // Recurrente mensual: al marcar el último estado aparece la siguiente.
    await user.click(within(dlg).getAllByLabelText('Abrir página')[0]);
    const page = within(dlg).getByRole('complementary');
    await user.selectOptions(within(page).getByLabelText('Repetir'), 'month');
    await user.click(within(page).getByLabelText('Estado'));
    await user.click(within(pop()).getByText('Entregado'));
    expect(within(dlg).getAllByLabelText('Tarea').map((x) => (x as HTMLInputElement).value || x.textContent)).toEqual(['Factura mensual', 'Factura mensual', 'Bocetos']);
    await user.click(within(page).getByLabelText('Cerrar página'));

    // Cronología: una fila sin fecha se fecha con un clic; los hitos se dibujan como ◆.
    await user.click(within(dlg).getByRole('tab', { name: 'Cronología' }));
    expect(dlg.querySelectorAll('.tl-row')).toHaveLength(3);
    expect(dlg.querySelectorAll('.tl-bar-item')).toHaveLength(0);
    fireEvent.click(dlg.querySelectorAll('.tl-lane')[2] as HTMLElement, { clientX: 200 });
    expect(dlg.querySelectorAll('.tl-bar-item')).toHaveLength(1);
    await user.click(within(dlg).getByRole('button', { name: 'Meses' }));
    expect(within(dlg).getByRole('button', { name: 'Meses' }).className).toContain('on');

    // Calendario: la fila fechada está en un día; las otras, en «Sin fecha».
    await user.click(within(dlg).getByLabelText('Añadir vista'));
    await user.click(within(pop()).getByText('Calendario'));
    expect(within(dlg).getByText('Sin fecha · 2')).toBeTruthy();
    expect(dlg.querySelectorAll('.month-cell .pm-chip')).toHaveLength(1);
  }, 40_000);
});
