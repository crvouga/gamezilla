import { expect } from 'bun:test';
import type { Square } from '@pkgs/chess-board-core-shared/types';
import type {
  ArrowAppearance,
  FeedbackAppearance,
} from '@pkgs/chess-board-harness/annotation-appearance';
import {
  chooseActivityArrow,
  readArrowAt,
  readPersonalArrowReport,
  supplyFeedbackMarks,
} from '@pkgs/chess-board-harness/annotation-appearance';
import type { BoardWorld } from '@pkgs/chess-board-harness/board-world';
import { readFeedbackAt } from '@pkgs/chess-board-harness/feedback-dom';
import { stepsFor } from '@pkgs/gherkin-shared/registry';
import type { Run } from '@pkgs/harness-shared/run-types';

const { Given, When, Then } = stepsFor<Run<BoardWorld>>();
Given('Alice has a centered green tick on e4', (w) =>
  w.apply(supplyFeedbackMarks, 'centered')
);
When(
  "Alice's activity supplies an arrow from e2 to e4 with (its ){} appearance",
  (w, appearance: ArrowAppearance) => w.apply(chooseActivityArrow, appearance)
);
When("Alice's activity supplies the usual feedback badges", (w) =>
  w.apply(supplyFeedbackMarks, 'usual')
);
When(
  "Alice's activity supplies a {word} tick on e4",
  (w, appearance: FeedbackAppearance) =>
    w.apply(supplyFeedbackMarks, appearance)
);
Then(
  'Alice sees a {} {word} arrow from e2 to e4',
  async (w, color: string, line: string) => {
    expect(await w.read(readArrowAt, 'e2 to e4')).toMatchObject({
      color,
      line,
      visible: true,
    });
  }
);
Then(
  'Alice sees a {} at the {word} of {word}',
  async (w, descriptor: string, placement: string, square: Square) => {
    expect(await w.read(readFeedbackAt, square)).toMatchObject({
      square,
      descriptor,
      placement,
      visible: true,
    });
  }
);
Then(
  'Alice sees two blue exclamation marks at the upper-right of f3',
  async (w) => {
    expect(await w.read(readFeedbackAt, 'f3')).toMatchObject({
      square: 'f3',
      symbol: 'exclamations',
      color: 'blue',
      placement: 'upper-right',
      visible: true,
    });
  }
);
Then(
  'Alice sees {string} in place of the usual badge symbol on f3',
  async (w, label: string) => {
    expect(await w.read(readFeedbackAt, 'f3')).toMatchObject({
      symbol: label,
      path: null,
      visible: true,
    });
  }
);
Then(
  "Alice's activity identifies the same primary green arrow from e2 to e4 alongside the new primary green arrow from g1 to f3",
  async (w) => {
    const view = await w.read(readPersonalArrowReport);
    expect(view.changes).toEqual([
      [
        { from: 'e2', to: 'e4', color: 'primary', id: 'e2-e4' },
        { from: 'g1', to: 'f3', color: 'primary', id: 'g1-f3' },
      ],
    ]);
    expect(view.painted).toMatchObject([
      { endpoints: 'e2 to e4', color: 'green', line: 'solid' },
      { endpoints: 'g1 to f3', color: 'green', line: 'solid' },
    ]);
    expect(view.painted.every((a) => a.opacity > 0 && a.opacity <= 1)).toBe(
      true
    );
  }
);
