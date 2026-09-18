import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  test,
} from 'bun:test';
import { Window } from 'happy-dom';

import {
  type PhoneLayers,
  paintHtmlLayer,
  paintPngLayer,
} from '../src/lib/phone-paint';

const dom = new Window();
const previousGlobals = {
  document: globalThis.document,
  HTMLIFrameElement: globalThis.HTMLIFrameElement,
  HTMLImageElement: globalThis.HTMLImageElement,
};
const loadEvent = (): Event => new dom.Event('load') as unknown as Event;
beforeAll(() => {
  Object.assign(globalThis, {
    document: dom.document,
    HTMLIFrameElement: dom.HTMLIFrameElement,
    HTMLImageElement: dom.HTMLImageElement,
  });
});

afterAll(() => {
  Object.assign(globalThis, previousGlobals);
});

afterEach(() => {
  dom.document.body.replaceChildren();
});

describe('phone snapshot layers', () => {
  function setup(): PhoneLayers {
    const frameEl = dom.document.createElement('div');
    dom.document.body.append(frameEl);
    return { frameEl: frameEl as unknown as HTMLDivElement, paintGen: 0 };
  }

  test('keeps the visible HTML snapshot until replacement loads', () => {
    const layers = setup();
    paintHtmlLayer(layers, '<html>A</html>');
    const first = layers.frameEl.querySelector('iframe.is-front');
    expect(first?.getAttribute('srcdoc')).toBe('<html>A</html>');

    paintHtmlLayer(layers, '<html>B</html>');
    expect(layers.frameEl.querySelector('iframe.is-front')).toBe(first);
    const pending = layers.frameEl.querySelector('iframe.is-back');
    expect(pending?.getAttribute('srcdoc')).toBe('<html>B</html>');

    pending?.dispatchEvent(loadEvent());
    expect(layers.frameEl.querySelector('iframe.is-front')).toBe(pending);
    expect(layers.frameEl.querySelectorAll('iframe')).toHaveLength(1);
  });

  test('discards an older pending paint before it can become visible', () => {
    const layers = setup();
    paintHtmlLayer(layers, '<html>A</html>');
    const first = layers.frameEl.querySelector('iframe.is-front');
    paintHtmlLayer(layers, '<html>B</html>');
    const oldPending = layers.frameEl.querySelector('iframe.is-back');

    paintHtmlLayer(layers, '<html>C</html>');
    first?.dispatchEvent(loadEvent());
    oldPending?.dispatchEvent(loadEvent());
    expect(layers.frameEl.querySelector('iframe.is-front')).toBe(first);
    expect(
      layers.frameEl.querySelector('iframe.is-front')?.getAttribute('srcdoc')
    ).toBe('<html>A</html>');

    const newest = layers.frameEl.querySelector('iframe.is-back');
    newest?.dispatchEvent(loadEvent());
    expect(
      layers.frameEl.querySelector('iframe.is-front')?.getAttribute('srcdoc')
    ).toBe('<html>C</html>');
  });

  test('keeps HTML visible while a PNG media switch loads', () => {
    const layers = setup();
    paintHtmlLayer(layers, '<html>A</html>');
    const html = layers.frameEl.querySelector('iframe.is-front');

    paintPngLayer(layers, 'https://pending.invalid/snapshot.png');
    expect(layers.frameEl.querySelector('iframe.is-front')).toBe(html);
    const pending = layers.frameEl.querySelector('img.is-back');
    pending?.dispatchEvent(loadEvent());

    expect(layers.frameEl.querySelector('img.is-front')).toBe(pending);
    expect(layers.frameEl.querySelector('iframe')).toBeNull();
  });
});
