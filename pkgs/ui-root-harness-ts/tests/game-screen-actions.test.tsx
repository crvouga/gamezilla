/** @jsxImportSource solid-js */

import { expect, test } from 'bun:test';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { mustQuery, renderUi } from './render';

test("a game screen's own next command sits in its title row, before the body", () => {
  renderUi(() => (
    <GameScreen
      screenId="builder"
      title="Two crates"
      subtitle="Puzzle builder"
      actions={<button type="button">Start playtest</button>}
    >
      <p class="text">{'board'}</p>
    </GameScreen>
  ));
  const intro = mustQuery('[data-component="ScreenIntro"]');
  const actions = mustQuery('[data-component="ScreenIntroActions"]');
  expect(intro.contains(actions)).toBe(true);
  expect(actions.textContent).toBe('Start playtest');
  const body = [...document.querySelectorAll('p')].find(
    (node) => node.textContent === 'board'
  );
  if (body === undefined) throw new Error('no body');
  expect(
    (actions.compareDocumentPosition(body) &
      Node.DOCUMENT_POSITION_FOLLOWING) !==
      0
  ).toBe(true);
});

test('without actions a game screen keeps its plain title block', () => {
  renderUi(() => (
    <GameScreen screenId="builder" title="Two crates">
      <p class="text">{'board'}</p>
    </GameScreen>
  ));
  expect(
    document.querySelector('[data-component="ScreenIntroActions"]')
  ).toBeNull();
});
