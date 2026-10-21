import { expect } from 'bun:test';
import type { Square } from '@pkgs/chess-board-core-shared-ts/types';
import {
  beginPersonalArrow,
  cancelPersonalArrow,
  clearActivityAnnotations,
  drawPersonalArrow,
  finishPersonalArrow,
  supplyActivityArrows,
  supplyActivitySquares,
  togglePersonalCircle,
} from '@pkgs/chess-board-root-harness-ts/annotation-actions';
import { readAnnotations } from '@pkgs/chess-board-root-harness-ts/annotation-reads';
import { prepareAnnotations } from '@pkgs/chess-board-root-harness-ts/annotation-setup';
import type { BoardWorld } from '@pkgs/chess-board-root-harness-ts/board-world';
import { configureBoard } from '@pkgs/chess-board-root-harness-ts/chess-board';
import { selectSquareWithKeyboard } from '@pkgs/chess-board-root-harness-ts/keyboard-actions';
import { readOptions } from '@pkgs/chess-board-root-harness-ts/options-reads';
import { stepsFor } from '@pkgs/gherkin-shared-ts/registry';
import type { Run } from '@pkgs/harness-root-shared-ts/run-types';

const { Given, When, Then } = stepsFor<Run<BoardWorld>>();

Given('Alice has a chessboard with personal annotations enabled', (w) =>
  w.apply(prepareAnnotations, {})
);
Given('Alice has a chessboard with personal annotations disabled', (w) =>
  w.apply(prepareAnnotations, { enabled: false })
);
Given(
  'Alice has personal arrows and circles alongside activity annotations',
  (w) => w.apply(prepareAnnotations, { personal: 'both', activity: true })
);
Given('Alice is drawing a personal arrow from e2 to e4', (w) =>
  w.apply(prepareAnnotations, { drawing: true })
);
Given('Alice has a personal arrow from e2 to e4', (w) =>
  w.apply(prepareAnnotations, { personal: 'arrow' })
);
Given('Alice has a personal circle on e4', (w) =>
  w.apply(prepareAnnotations, { personal: 'circle', circle: 'e4' })
);
Given('Alice has a personal arrow from e2 to e4 and circle on d5', (w) =>
  w.apply(prepareAnnotations, { personal: 'both' })
);
Given('Alice is drawing a personal arrow alongside activity annotations', (w) =>
  w.apply(prepareAnnotations, { activity: true, drawing: true })
);
When("Alice's activity supplies colored arrows", (w) =>
  w.apply(supplyActivityArrows)
);
When("Alice's activity supplies square annotations", (w) =>
  w.apply(supplyActivitySquares)
);
When("Alice's activity removes its annotations", (w) =>
  w.apply(clearActivityAnnotations)
);
When('Alice finishes drawing the personal arrow', (w) =>
  w.apply(finishPersonalArrow)
);
When(
  'Alice draws a personal arrow from {word} to {word}',
  (w, from: Square, to: Square) => w.apply(drawPersonalArrow, from, to)
);
When('Alice marks {word} with a personal circle', (w, square: Square) =>
  w.apply(togglePersonalCircle, square)
);
When(
  'Alice begins drawing a personal arrow from {word} to {word}',
  (w, from: Square, to: Square) => w.apply(beginPersonalArrow, from, to)
);
When('Alice cancels the personal arrow', (w) => w.apply(cancelPersonalArrow));
When("Alice's board settings disable personal annotations", (w) =>
  w.apply(configureBoard, { enableUserArrows: false })
);
When("Alice's board settings enable personal annotations", (w) =>
  w.apply(configureBoard, { enableUserArrows: true })
);
Then('Alice sees a capture ring on {word}', async (w, square: Square) =>
  expect((await w.read(readOptions)).marks).toContain('ring@' + square)
);
Then(
  'Alice sees a quiet destination dot on {word}',
  async (w, square: Square) =>
    expect((await w.read(readOptions)).marks).toContain('dot@' + square)
);
Then(
  'Alice is not offered a capture ring on e4 because e4 is empty',
  async (w) =>
    expect((await w.read(readOptions)).marks).not.toContain('ring@e4')
);
Then('Alice sees a blue dashed arrow from a1 to a8', async (w) =>
  expect(
    (await w.read(readAnnotations)).arrows.find(
      (a) => a.token === 'arrow:blue@a1-a8'
    )
  ).toMatchObject({
    color: 'blue',
    dashed: true,
  })
);
Then('Alice sees a blue fill on d5', async (w) =>
  expect(
    (await w.read(readAnnotations)).highlights.find(
      (h) => h.token === 'highlight@d5'
    )
  ).toMatchObject({ color: 'blue' })
);
Then('Alice sees a gold ring on e4', async (w) => {
  const mark = (await w.read(readAnnotations)).highlights.find(
    (h) => h.token === 'highlight:ring@e4'
  );
  expect(mark?.ring).toContain('gold');
});
Then('Alice sees the badge named {string} on f3', async (w, name: string) =>
  expect(
    (await w.read(readAnnotations)).badges.find(
      (b) => b.token === 'feedback:dot@f3'
    )?.name
  ).toBe(name)
);
Then('Alice sees no personal annotations', async (w) => {
  const view = await w.read(readAnnotations);
  expect(view.personalArrows).toEqual([]);
  expect(view.circles).toEqual([]);
});
Then("Alice sees the activity's arrows and square annotations", async (w) => {
  const view = await w.read(readAnnotations);
  expect(
    view.arrows.find((a) => a.token === 'arrow:green@e2-e4')
  ).toMatchObject({
    color: 'green',
    dashed: false,
  });
  expect(view.arrows.find((a) => a.token === 'arrow:blue@a1-a8')).toMatchObject(
    {
      color: 'blue',
      dashed: true,
    }
  );
  expect(view.highlights.find((h) => h.token === 'highlight@d5')).toMatchObject(
    { color: 'blue' }
  );
  expect(
    view.highlights.find((h) => h.token === 'highlight:ring@e4')?.ring
  ).toContain('gold');
  expect(view.badges.find((b) => b.token === 'feedback:dot@f3')?.name).toBe(
    'Plan'
  );
});
Then('Alice sees no activity annotations', async (w) => {
  const view = await w.read(readAnnotations);
  expect(
    view.arrows.filter((a) => !a.token.startsWith('arrow:primary@'))
  ).toEqual([]);
  expect(view.highlights).toEqual([]);
  expect(view.badges).toEqual([]);
});
Then(
  'Alice still sees the personal arrow from e2 to e4 and circle on d5',
  async (w) => {
    const view = await w.read(readAnnotations);
    expect(view.personalArrows).toContain('arrow:primary@e2-e4');
    expect(view.circles).toContain('circle:primary@d5');
  }
);
Then('Alice sees a personal arrow from e2 to e4', async (w) =>
  expect((await w.read(readAnnotations)).personalArrows).toContain(
    'arrow:primary@e2-e4'
  )
);
Then('Alice sees no personal arrow from e2 to e4', async (w) =>
  expect((await w.read(readAnnotations)).personalArrows).not.toContain(
    'arrow:primary@e2-e4'
  )
);
Then(
  "Alice's activity receives the personal arrow from e2 to e4 without square annotations",
  async (w) => {
    const changes = (await w.read(readAnnotations)).changes;
    expect(changes).toHaveLength(1);
    expect(changes[0]).toEqual([
      { from: 'e2', to: 'e4', color: 'primary', id: 'e2-e4' },
    ]);
  }
);

Then('Alice sees a personal circle on e4', async (w) =>
  expect((await w.read(readAnnotations)).circles).toContain('circle:primary@e4')
);
Then('Alice sees no personal circle on {word}', async (w, square: Square) =>
  expect((await w.read(readAnnotations)).circles).not.toContain(
    'circle:primary@' + square
  )
);
Then(
  'Alice cannot add a personal annotation while they are disabled',
  async (w) => {
    const view = await w.read(readAnnotations);
    expect(view.enabled).toBe(false);
    expect(view.personalArrows).toEqual([]);
    expect(view.circles).toEqual([]);
    expect(view.changes).toEqual([]);
  }
);
Then('Alice sees an unfinished personal arrow from e2 to e4', async (w) =>
  expect((await w.read(readAnnotations)).unfinished).toEqual([
    'arrow-preview:primary@e2-e4',
  ])
);
Then("Alice's activity receives no annotation changes", async (w) =>
  expect((await w.read(readAnnotations)).changes).toEqual([])
);
Then('Alice is not offered a completed personal arrow', async (w) => {
  const view = await w.read(readAnnotations);
  expect(view.personalArrows).toEqual([]);
  expect(view.changes).toEqual([]);
});
Then('Alice sees no unfinished personal arrow', async (w) =>
  expect((await w.read(readAnnotations)).unfinished).toEqual([])
);
Then('Alice can draw a personal arrow', async (w) =>
  expect((await w.read(readAnnotations)).enabled).toBe(true)
);

Given(
  'Alice has personal arrows and circles alongside activity annotations on a chessboard facing Black',
  async (w) => {
    await w.apply(prepareAnnotations, { personal: 'both', activity: true });
    await w.apply(configureBoard, { orientation: 'black' });
  }
);

Given('Alice has personal annotations disabled', (w) =>
  w.apply(configureBoard, { enableUserArrows: false })
);
When(
  'Alice selects the piece on {word} with the keyboard',
  (w, square: Square) => w.apply(selectSquareWithKeyboard, square)
);
Then(
  "Alice's activity receives exactly one empty set of personal arrows",
  async (w) => expect((await w.read(readAnnotations)).changes).toEqual([[]])
);
