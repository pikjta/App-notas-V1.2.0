// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import App from '../App';
import { getLang, setLang } from '../i18n';

afterEach(() => { cleanup(); setLang('es'); localStorage.setItem('cuaderno.lang', 'es'); document.documentElement.lang = 'es'; });

describe('idiomas: cambio en caliente desde Ajustes', () => {
  it('cambia la interfaz a inglés y a francés, y recuerda el idioma', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Inicio' });
    await user.click(screen.getByText('Ajustes'));
    const sel = await screen.findByLabelText('Idioma');
    await user.selectOptions(sel, 'en');
    expect(getLang()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('cuaderno.lang')).toBe('en');
    expect(await screen.findByLabelText('Language')).toBeTruthy();
    expect(screen.queryByText('Ajustes')).toBeNull();
    await user.selectOptions(screen.getByLabelText('Language'), 'fr');
    expect(await screen.findByLabelText('Langue')).toBeTruthy();
    expect(document.documentElement.lang).toBe('fr');
    // el nombre propio del idioma no se traduce
    expect(screen.getByRole('option', { name: 'Deutsch' })).toBeTruthy();
  }, 20_000);
});
