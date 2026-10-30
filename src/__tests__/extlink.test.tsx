// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Markdown } from '../lib/markdown';

afterEach(cleanup);

describe('enlaces normales', () => {
  it('al hacer clic piden abrir la dirección en el navegador del sistema', () => {
    const got: string[] = [];
    const h = (e: Event) => got.push(String((e as CustomEvent).detail));
    window.addEventListener('cuaderno:open-url', h);
    render(<Markdown body="Mira [la guía](https://example.com/a?b=1)" link={() => ({ ok: false, go: () => undefined })} onToggle={() => undefined} />);
    fireEvent.click(screen.getByText('la guía'));
    window.removeEventListener('cuaderno:open-url', h);
    expect(got).toEqual(['https://example.com/a?b=1']);
  });
});
