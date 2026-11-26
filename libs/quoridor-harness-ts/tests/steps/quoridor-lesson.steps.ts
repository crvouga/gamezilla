import { expect } from 'bun:test';
import {
  openGameChoice,
  pickGame,
} from '@libs/game-session-harness-ts/game-navigation';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import {
  movePracticePawn,
  practiceMoveFinished,
  practiceOpening,
} from '@libs/quoridor-harness-ts/quoridor-lesson-actions';
import { createSpace } from '@libs/spaces-harness-ts/space-actions';

async function chooseClassic(w: HarnessWorld, actor: string) {
  await w.s.apply(createSpace, actor);
  await w.s.apply(pickGame, actor, 'quoridor');
}
Given('{actor} has chosen Classic Quoridor for her space', chooseClassic);
Given("{actor} is practising South's first move", async (w, actor: string) => {
  await chooseClassic(w, actor);
  await w.s.apply(openGameChoice, actor, 'how-to-play');
});
When('{actor} opens its lesson', async (w, actor: string) => {
  await w.s.apply(openGameChoice, actor, 'how-to-play');
});
When(
  '{actor} moves the practice pawn to {word}',
  async (w, actor: string, cell: string) => {
    await w.s.apply(movePracticePawn, actor, cell);
  }
);
async function expectOpening(w: HarnessWorld, actor: string) {
  const opening = await w.s.read(practiceOpening, actor);
  expect(opening.pawn).toContain('South red circle');
  expect(opening.forward).toBe('false');
  expect(opening.next).toBe(false);
}
Then(
  "{actor} can move South's pawn from e1 to e2 on the practice board",
  expectOpening
);
Then("{actor} can still try South's forward move from e1", expectOpening);
Then(
  '{actor} can continue to the lesson on placing a wall',
  async (w, actor: string) => {
    expect(await w.s.read(practiceMoveFinished, actor)).toBe(true);
  }
);
