/** A fresh happy-dom document holding `html` in its body. */

import { Window } from 'happy-dom';

export function page(html = ''): Document {
  const window = new Window();
  const document = window.document as unknown as Document;
  document.body.innerHTML = html;
  return document;
}

/** The element with `id`, or a failure naming it. */
export function byId(document: Document, id: string): Element {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`no #${id}`);
  return element;
}
