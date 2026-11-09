import { afterEach, expect, spyOn, test } from 'bun:test';
import { builderControlsUncovered } from './storybook/builder-control-visibility';

const restores: (() => void)[] = [];
afterEach(() => {
  for (const restore of restores.splice(0)) restore();
  document.body.replaceChildren();
});

function builderFixture(covered = false, reachable = true) {
  document.body.innerHTML = `<section data-screen="puzzle-content-author"><div data-testid="content-author-stage"><button aria-label="Undo">Undo</button></div><div data-testid="content-author-publish">Publish</div></section><header>Header</header>`;
  const scroller = document.querySelector<HTMLElement>('section');
  const control = document.querySelector('button');
  const header = document.querySelector('header');
  const publish = document.querySelector<HTMLElement>(
    '[data-testid="content-author-publish"]'
  );
  if (!scroller || !control || !header || !publish)
    throw new Error('Fixture missing');
  const oldWidth = window.innerWidth;
  const oldHeight = window.innerHeight;
  restores.push(() => {
    Object.defineProperty(window, 'innerWidth', {
      value: oldWidth,
      configurable: true,
    });
    Object.defineProperty(window, 'innerHeight', {
      value: oldHeight,
      configurable: true,
    });
  });
  Object.defineProperty(window, 'innerWidth', {
    value: 1200,
    configurable: true,
  });
  Object.defineProperty(window, 'innerHeight', {
    value: 884,
    configurable: true,
  });
  scroller.getBoundingClientRect = () => new DOMRect(240, 84, 960, 800);
  Object.defineProperty(scroller, 'scrollHeight', { value: 1200 });
  let reached = false;
  control.getBoundingClientRect = () =>
    new DOMRect(700, scroller.scrollTop === 0 || reached ? 300 : 34, 80, 44);
  control.scrollIntoView = () => {
    reached = reachable;
  };
  publish.getBoundingClientRect = () => new DOMRect(260, 700, 900, 100);
  const hit = spyOn(document, 'elementFromPoint').mockImplementation((_, y) =>
    y < 84 || covered ? header : control
  );
  restores.push(() => hit.mockRestore());
  return { reached: () => reached };
}

// regression: sokoban-builder-scrollport-clipping-is-not-overlap
test('builder clipping outside its scrollport is not an overlap and every control is reached', () => {
  const fixture = builderFixture();
  expect(builderControlsUncovered()).toEqual([]);
  expect(fixture.reached()).toBe(true);
});

test('builder controls genuinely covered inside the scrollport remain failures', () => {
  builderFixture(true);
  expect(builderControlsUncovered()).toContain('top: Undo');
  expect(builderControlsUncovered()).toContain('reach: Undo');
});

test('builder controls that cannot scroll into view remain failures', () => {
  builderFixture(false, false);
  expect(builderControlsUncovered()).toContain('reach: Undo');
});
