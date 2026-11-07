import { afterAll, beforeAll, expect, test } from 'bun:test';
import { runInThisContext } from 'node:vm';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { visibilityScript } from '@pkgs/ui-testing-bun-webview-shared-ts/visibility-script';

beforeAll(() => {
  GlobalRegistrator.register();
  // Happy DOM omits the browser's user-agent rule for the hidden attribute.
  const style = document.createElement('style');
  style.textContent = '[hidden] { display: none; }';
  document.head.append(style);
});
afterAll(() => GlobalRegistrator.unregister());

function visible(html: string, selector = '[data-testid="target"]'): boolean {
  document.body.innerHTML = html;
  return runInThisContext(visibilityScript([selector]));
}

// regression: webview-visibility-hidden-tab-descendant
test('a Numberlink draft in the inactive Your work tab is hidden', () => {
  expect(
    visible(
      '<section role="tabpanel" hidden><button data-testid="content-draft-fcdde7df-fc62-4540-8f81-e94ea3df438e">Numberlink river</button></section>',
      '[data-testid="content-draft-fcdde7df-fc62-4540-8f81-e94ea3df438e"]'
    )
  ).toBe(false);
});

test.each([
  ['display: none', false],
  ['opacity: 0', false],
  ['visibility: hidden', false],
  ['display: contents', true],
  ['opacity: 0.5', true],
])('a button respects its ancestor with %s', (style, expected) => {
  expect(
    visible(
      `<section style="${style}"><button data-testid="target">Open</button></section>`
    )
  ).toBe(expected);
});

test('an explicit visible descendant can override inherited visibility', () => {
  expect(
    visible(
      '<section style="visibility:hidden"><button style="visibility:visible" data-testid="target">Open</button></section>'
    )
  ).toBe(true);
});

test('transparent native choices require a visible label and visible ancestors', () => {
  const choice =
    '<label for="choice">Select</label><input id="choice" data-testid="target" type="checkbox" style="opacity:0">';
  expect(visible(choice)).toBe(true);
  expect(visible(`<section hidden>${choice}</section>`)).toBe(false);
  expect(visible(`<section style="opacity:0">${choice}</section>`)).toBe(false);
  expect(
    visible(
      '<section hidden><label for="choice">Select</label></section><input id="choice" data-testid="target" type="radio" style="opacity:0">'
    )
  ).toBe(false);
});

test('alternate controls only succeed when at least one is visible', () => {
  document.body.innerHTML =
    '<section hidden><button id="hidden">Hidden</button></section><button id="ready">Ready</button>';
  expect(runInThisContext(visibilityScript(['#missing', '#hidden']))).toBe(
    false
  );
  expect(runInThisContext(visibilityScript(['#hidden', '#ready']))).toBe(true);
});
