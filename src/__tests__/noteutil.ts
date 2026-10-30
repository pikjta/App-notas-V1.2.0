// Ayudas para probar el editor de la Nota en jsdom: user-event no sabe escribir dentro de un
// contenteditable con bloques, así que se inserta el texto con la API de selección y se lanza `input`.
import { fireEvent } from '@testing-library/react';
import { caretIn } from '../lib/richnote';

export function focusNote(ed: HTMLElement) {
  ed.focus();
  const s = window.getSelection()!;
  if (!s.rangeCount || s.anchorNode === ed || !ed.contains(s.anchorNode)) caretIn(ed.lastElementChild as HTMLElement, true);
}
/** Escribe texto en el cursor de la nota. */
export function typeNote(ed: HTMLElement, text: string) {
  focusNote(ed);
  const s = window.getSelection()!;
  let r = s.getRangeAt(0);
  if (!r.collapsed) { r.deleteContents(); }
  const n = r.startContainer, o = r.startOffset;
  if (n.nodeType === 3) { (n as Text).insertData(o, text); r = document.createRange(); r.setStart(n, o + text.length); }
  else {
    (n as HTMLElement).querySelector?.(':scope > br')?.remove();
    const t = document.createTextNode(text); r.insertNode(t); r = document.createRange(); r.setStart(t, text.length);
  }
  r.collapse(true); s.removeAllRanges(); s.addRange(r);
  fireEvent.input(ed);
}
export const pressNote = (ed: HTMLElement, key: string, init: object = {}) => { focusNote(ed); fireEvent.keyDown(ed, { key, ...init }); };
