import { expect, test } from 'bun:test';
import { visibilityScript } from '@pkgs/ui-testing-bun-webview-shared-ts/visibility-script';
import { Window } from 'happy-dom';

// regression: browser-hidden-library-tab-visible
test('a draft in an inactive library panel is not visible', () => {
  const window = new Window();
  window.document.body.innerHTML = `
    <button id="mine">My creations</button>
    <section hidden><button id="draft">River</button></section>`;
  const visible = () => window.eval(visibilityScript(['#draft']));
  expect(visible()).toBe(false);
  expect(window.eval(visibilityScript(['#draft', '#mine']))).toBe(true);
  const panel = window.document.querySelector('section')!;
  panel.hidden = false;
  expect(visible()).toBe(true);
  panel.style.display = 'none';
  expect(visible()).toBe(false);
  panel.style.display = 'block';
  panel.style.opacity = '0';
  expect(visible()).toBe(false);
});

test('transparent choice inputs require a visible label and ancestors', () => {
  const window = new Window();
  window.document.body.innerHTML = `
    <section><label for="choice">Choose</label>
      <input id="choice" type="radio" style="opacity:0">
    </section>`;
  const visible = () => window.eval(visibilityScript(['#choice']));
  expect(visible()).toBe(true);
  window.document.querySelector('section')!.hidden = true;
  expect(visible()).toBe(false);
});
