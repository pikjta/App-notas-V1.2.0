// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { typeNote } from './noteutil';
import App from '../App';

afterEach(cleanup);

describe('Fase 4a en la interfaz', () => {
  it('grafo: nodos, filtros, búsqueda y panel de conexiones', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getByText('+ Tarea principal'));
    await user.type(screen.getByPlaceholderText('Nombre de la tarea principal'), 'Mural Café Aurora{Enter}');
    await user.click(screen.getByText('+ Añadir tarjeta'));
    await user.click(screen.getByRole('menuitem', { name: 'Nota' }));
    await user.type(screen.getAllByPlaceholderText('Sin título').slice(-1)[0], 'Brief');
    const ed = screen.getByRole('textbox', { name: 'Contenido de la nota' });
    typeNote(ed, 'Ver [[Inicio]]');
    await act(async () => { ed.blur(); });

    await user.click(screen.getByText('Grafo'));
    const svg = screen.getByRole('img', { name: /Grafo con \d+ nodos/ });
    expect(svg.getAttribute('aria-label')).toMatch(/Grafo con 4 nodos y 1 conexiones/);
    await user.click(screen.getByLabelText('Tarjetas'));
    expect(screen.getByRole('img').getAttribute('aria-label')).toMatch(/Grafo con 2 nodos y 1 conexiones/);
    await user.click(screen.getByLabelText('Tarjetas'));

    await user.type(screen.getByLabelText('Resaltar nodos'), 'brief');
    expect(document.querySelectorAll('.g-node:not(.dim)')).toHaveLength(1);
    await user.clear(screen.getByLabelText('Resaltar nodos'));

    const brief = [...document.querySelectorAll<SVGGElement>('.g-node')].find((g) => g.textContent?.includes('Brief'))!;
    await user.pointer([{ keys: '[MouseLeft>]', target: brief }, { keys: '[/MouseLeft]', target: brief }]);
    const panel = screen.getByRole('complementary', { name: 'Conexiones de Brief' });
    expect(within(panel).getByText('Enlace [[ ]] · 1')).toBeTruthy();
    expect(within(panel).getByText('Inicio')).toBeTruthy();
    await user.click(within(panel).getByText('Abrir'));
    expect(await screen.findByRole('heading', { name: 'Mural Café Aurora' })).toBeTruthy();
  }, 30_000);

  it('backup en tres niveles: carpeta, automático, interno, manual e indicador', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getByText('Ajustes'));
    await user.click(screen.getByText('Backup', { selector: 'nav button' }));
    expect(await screen.findByText('/Descargas')).toBeTruthy();
    await user.click(screen.getByText('Elegir carpeta…'));
    expect(screen.getByText('/carpeta/de/prueba')).toBeTruthy();
    await user.click(screen.getByText('Volver a Descargas'));
    expect(screen.getByText('/Descargas')).toBeTruthy();

    // Automático
    await user.click(screen.getByRole('switch', { name: 'Activar backup automático' }));
    await user.click(screen.getByText('Hacer copia ahora'));
    expect(await screen.findByText(/Última copia: .* cuaderno_auto_\d{4}-\d{2}-\d{2}_\d{6}\.json/)).toBeTruthy();

    // Interno: crear y restaurar
    await user.click(screen.getByRole('switch', { name: 'Activar backup interno' }));
    await user.click(screen.getByText('Crear copia ahora'));
    expect(await screen.findByText('Copias internas recientes · 1')).toBeTruthy();
    await user.click(screen.getByText('Restaurar'));
    await user.click(screen.getByText('Sí, restaurar'));
    expect(await screen.findByText('Copia interna restaurada')).toBeTruthy();

    // Manual
    await user.click(screen.getByText('Exportar copia', { selector: 'button' }));
    await user.click(screen.getByText('Exportar ahora'));
    expect(await screen.findByText('Copia creada')).toBeTruthy();

    // Indicador en la barra lateral
    await user.click(screen.getByLabelText('Cerrar'));
    expect(await screen.findByText('Backup activo')).toBeTruthy();
  }, 30_000);
});
