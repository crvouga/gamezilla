import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';

import {
  drawHit,
  ensureShell,
  paintSnapshot,
  resolveHitTarget,
} from '../src/lib/snapshot-surface';

const dom = new Window();
const previousDomParser = globalThis.DOMParser;

beforeAll(() => {
  Object.assign(globalThis, { DOMParser: dom.DOMParser });
});

afterAll(() => {
  Object.assign(globalThis, { DOMParser: previousDomParser });
});

function shellDoc(): Document {
  const doc =
    dom.document.implementation.createHTMLDocument() as unknown as Document;
  ensureShell(doc, '.app{color:red}');
  return doc;
}

const page = (body: string, cls = 'dark'): string =>
  `<!DOCTYPE html><html class="${cls}"><head><style>.s{}</style><script>boom()</script></head><body>${body}</body></html>`;

const LIST = `
  <div data-testid="list">
    <div data-testid="row"><button data-testid="ok" id="first">A</button></div>
    <div data-testid="row"><button data-testid="ok" id="second">B</button></div>
  </div>
  <div data-testid="other"><button data-testid="ok" id="third">C</button></div>`;

describe('snapshot surface', () => {
  test('installs the shell once and keeps frameCss across paints', () => {
    const doc = shellDoc();
    const style = doc.getElementById('sr-frame-css');
    expect(style?.textContent).toContain('.app{color:red}');
    paintSnapshot(doc, { key: 'a', html: page('<p>A</p>') }, null);
    paintSnapshot(doc, { key: 'b', html: page('<p>B</p>', 'light') }, null);
    ensureShell(doc, 'ignored');
    expect(doc.getElementById('sr-frame-css')).toBe(style);
    expect(doc.body.innerHTML).toBe('<p>B</p>');
    expect(doc.documentElement.getAttribute('class')).toBe('light');
  });

  test('strips scripts and dedupes snapshot head nodes', () => {
    const doc = shellDoc();
    paintSnapshot(doc, { key: 'a', html: page('<p>A</p>') }, null);
    paintSnapshot(doc, { key: 'b', html: page('<p>B</p>') }, null);
    expect(doc.querySelectorAll('script')).toHaveLength(0);
    expect(doc.head.querySelectorAll('[data-sr-snap]')).toHaveLength(1);
  });

  test('resolves chained first match like the driver', () => {
    const doc = shellDoc();
    paintSnapshot(doc, { key: 'list', html: page(LIST) }, null);
    expect(resolveHitTarget(doc, ['ok'])?.id).toBe('first');
    expect(resolveHitTarget(doc, ['other', 'ok'])?.id).toBe('third');
    expect(resolveHitTarget(doc, ['list', 'row', 'ok'])?.id).toBe('first');
    expect(resolveHitTarget(doc, ['nope'])).toBeNull();
  });

  test('draws exactly one overlay, hides it when no hit', () => {
    const doc = shellDoc();
    const html = page(LIST);
    expect(paintSnapshot(doc, { key: 'l', html }, { path: ['ok'] })).toBe(
      'found'
    );
    expect(
      paintSnapshot(doc, { key: 'l', html }, { path: ['other', 'ok'] })
    ).toBe('found');
    expect(doc.querySelectorAll('#sr-press')).toHaveLength(1);
    expect(drawHit(doc, null)).toBe('none');
    expect(doc.getElementById('sr-press')?.style.display).toBe('none');
  });

  test('reports a missing target instead of guessing', () => {
    const doc = shellDoc();
    const res = paintSnapshot(
      doc,
      { key: 'm', html: page('<p>gone</p>') },
      { path: ['ok'] }
    );
    expect(res).toBe('missing');
    expect(doc.getElementById('sr-press')).toBeNull();
  });
});
