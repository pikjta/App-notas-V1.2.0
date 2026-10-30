// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';

afterEach(cleanup);
const pop = () => document.querySelector('.pm-pop') as HTMLElement;

describe('Tabla PM · Fase 3d en la interfaz', () => {
  it('fórmula con aviso de errores, relación interna y externa con alias y vista previa, resumen y galería', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    const newTable = async (tpl: string) => {
      await user.click(screen.getByText('+ Añadir tarjeta'));
      await user.click(screen.getByRole('menuitem', { name: 'Tabla PM' }));
      await user.click(within(screen.getByRole('dialog', { name: 'Nueva Tabla PM' })).getByText(tpl));
      return screen.getByRole('dialog', { name: /Tabla PM/ });
    };
    // Tabla de materiales con precios.
    let dlg = await newTable('Proyecto con fases');
    await user.clear(within(dlg).getByLabelText('Título de la tabla')); await user.type(within(dlg).getByLabelText('Título de la tabla'), 'Materiales');
    await user.click(within(dlg).getByText('+ Nueva fila'));
    await user.keyboard('Pintura{Enter}Barniz');
    const pres = within(dlg).getAllByLabelText('Presupuesto');
    await user.type(pres[0], '180'); await user.type(pres[1], '45,5');
    await user.click(within(dlg).getByLabelText('Cerrar'));

    // Tabla de seguimiento con relación, resumen y fórmula.
    dlg = await newTable('Proyecto con fases');
    await user.click(within(dlg).getByText('+ Nueva fila'));
    await user.keyboard('Mural del café');
    await user.click(within(dlg).getByText('+ Nueva columna'));
    await user.click(within(pop()).getByText(/Relación/));
    await user.click(within(dlg).getByText('Relación', { selector: '.th-in span' }));
    await user.selectOptions(within(pop()).getByLabelText(/Tabla enlazada/), 'Materiales');
    await user.keyboard('{Escape}');
    await user.dblClick(within(dlg).getByLabelText('Relación'));
    await user.click(within(pop()).getByText('Pintura'));
    await user.click(within(pop()).getByText('Barniz'));
    await user.type(within(pop()).getByLabelText('Alias de Barniz'), 'Barniz UV');
    await user.click(within(pop()).getByRole('button', { name: 'Externa' }));
    await user.click(within(pop()).getByLabelText('Incluir tarjetas y filas'));
    await user.type(within(pop()).getByLabelText('Buscar para enlazar'), 'bienvenida');
    await user.click(within(pop()).getByText('Bienvenida'));
    // Vista previa de un enlace.
    await user.click(within(pop()).getAllByText('Ver')[0]);
    expect(within(pop()).getByRole('heading', { name: 'Pintura' })).toBeTruthy();
    expect(within(pop()).getByText('180 €')).toBeTruthy();
    await user.click(within(pop()).getByText('← Volver'));
    await user.keyboard('{Escape}');
    expect(within(dlg).getByText('Barniz UV')).toBeTruthy();

    // Ya no hay columnas «Fórmula» ni «Resumen»: las fórmulas se escriben en la celda, como en Excel.
    await user.click(within(dlg).getByText('+ Nueva columna'));
    expect(within(pop()).queryByText(/Fórmula/)).toBeNull();
    expect(within(pop()).queryByText(/Resumen/)).toBeNull();
    await user.click(within(pop()).getByText(/Número/));
    const last = () => [...dlg.querySelectorAll('td[data-r="0"]')].slice(-1)[0] as HTMLElement;
    await user.click(last());
    await user.keyboard('=2*3+10{Tab}');
    expect(last().textContent).toBe('16');

    // Galería.
    await user.click(within(dlg).getByLabelText('Añadir vista'));
    await user.click(within(pop()).getByText('Galería'));
    expect(dlg.querySelectorAll('.gcard')).toHaveLength(1);
    await user.click(within(dlg).getByRole('button', { name: 'L' }));
    expect(dlg.querySelector('.gallery')!.className).toContain('size-L');
  }, 40_000);
});
