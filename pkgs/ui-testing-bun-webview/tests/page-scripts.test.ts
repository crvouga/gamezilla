/**
 * Page-side semantics of the Bun.WebView node, evaluated in happy-dom: they
 * must read the UI the way the happy-dom driver does, so one scenario means
 * the same thing on the in-process and full-stack hosts.
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import {
  focusFieldScript,
  isVisibleScript,
  markTapTargetScript,
  TAP_TARGET_ATTR,
  textScript,
} from '@pkgs/ui-testing-bun-webview/page-scripts';

/** Page scripts are expression strings; evaluate them as the browser would. */
function run(script: string): unknown {
  // biome-ignore lint/nursery/noImpliedEval: the unit under test is script text.
  return new Function(`return ${script};`)();
}

const byId = (id: string) => `[data-testid="${id}"]`;

beforeAll(() => {
  GlobalRegistrator.register();
});

afterAll(async () => {
  await GlobalRegistrator.unregister();
});

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('isVisibleScript', () => {
  test('a hidden ancestor hides the node', () => {
    document.body.innerHTML = `
      <div style="display:none"><span data-testid="inner">x</span></div>
      <div aria-hidden="true"><span data-testid="aria">x</span></div>
      <span data-testid="shown">x</span>`;
    expect(run(isVisibleScript(byId('inner')))).toBe(false);
    expect(run(isVisibleScript(byId('aria')))).toBe(false);
    expect(run(isVisibleScript(byId('shown')))).toBe(true);
    expect(run(isVisibleScript(byId('missing')))).toBe(false);
  });
});

describe('textScript', () => {
  test('buttons read their visible label, not the empty value', () => {
    document.body.innerHTML = `
      <button data-testid="style">Bottts<span aria-hidden="true">Saved</span></button>`;
    expect(run(textScript(byId('style')))).toEqual({ text: 'Bottts' });
  });

  test('a wrapper reads its single field value', () => {
    document.body.innerHTML = `
      <div data-testid="username"><label>Name</label><input value="alice" /></div>`;
    expect(run(textScript(byId('username')))).toEqual({ text: 'alice' });
  });

  test('falls back to aria-label, and null for a missing node', () => {
    document.body.innerHTML = `<button data-testid="close" aria-label="Close"></button>`;
    expect(run(textScript(byId('close')))).toEqual({ text: 'Close' });
    expect(run(textScript(byId('missing')))).toBeNull();
  });
});

describe('focusFieldScript', () => {
  test('focuses the field inside a wrapper with the caret at the end', () => {
    document.body.innerHTML = `<div data-testid="search"><input value="bo" /></div>`;
    expect(run(focusFieldScript(byId('search'), 'end'))).toBe(true);
    const input = document.querySelector('input');
    expect(document.activeElement).toBe(input);
    expect(input?.selectionStart).toBe(2);
  });

  test('reports nodes without a text field', () => {
    document.body.innerHTML = `<button data-testid="go">Go</button>`;
    expect(run(focusFieldScript(byId('go'), 'select'))).toBe(false);
  });
});

describe('duplicate matches', () => {
  test('reads and taps resolve to the first visible match', () => {
    document.body.innerHTML = `
      <div style="visibility:hidden"><button data-testid="back">Measure</button></div>
      <button data-testid="back">Back</button>`;
    expect(run(isVisibleScript(byId('back')))).toBe(true);
    expect(run(textScript(byId('back')))).toEqual({ text: 'Back' });
    expect(run(markTapTargetScript(byId('back')))).toBe(true);
    const targets = document.querySelectorAll(`[${TAP_TARGET_ATTR}]`);
    expect(targets.length).toBe(1);
    expect(targets[0]?.textContent).toBe('Back');
  });
});
