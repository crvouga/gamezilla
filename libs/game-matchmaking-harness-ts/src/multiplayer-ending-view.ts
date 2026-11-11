import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';
import { onMultiplayerPlace } from './multiplayer-places';

/** The ending choices and result actually shown by the two seats and announcement. */
export async function multiplayerEndingView(s: ProductHarness, actor: string) {
  await bringToFront(s, actor);
  const ui = await actorUi(s, actor);
  const board = ui.get('multiplayer-game');
  const outcome = await board.attribute('data-outcome');
  const announcement = (await ui.get('multiplayer-announcement').text()) ?? '';
  let result = 'missing';
  if (outcome === 'ongoing') result = 'unfinished';
  if (outcome === 'aborted' && announcement.includes('aborted'))
    result = 'aborted';
  if (
    (outcome === 'white' || outcome === 'black') &&
    announcement.includes('won')
  ) {
    for (const seatId of ['multiplayer-seat-near', 'multiplayer-seat-far']) {
      const seat = ui.get(seatId);
      if ((await seat.attribute('data-side')) !== outcome) continue;
      // The seat leads with the side's mark (Light Cycles' rider letter)
      // before the name, and its text joins without spaces.
      const name = ((await seat.text()) ?? '')
        .toLowerCase()
        .match(/(alice|bob)/)?.[1];
      if (name !== undefined) result = `${name} won`;
    }
  }
  const gameId = await board.attribute('data-game-id');
  const position = await board.attribute('data-shown-position');
  // Aborting and resigning are among the game's commands, one press away.
  const leaving = await onMultiplayerPlace(s, actor, 'commands', async () => ({
    abortOffered: await ui.get('multiplayer-abort').isVisible(),
    resignOffered: await ui.get('multiplayer-resign').isVisible(),
  }));
  return { result, gameId, position, ...leaving };
}

/** The model's two people, each observed on their own rendered device. */
export async function multiplayerEndings(s: ProductHarness) {
  const people = ['alice', 'bob'] as const;
  const views = [];
  for (const person of people)
    views.push([person, await multiplayerEndingView(s, person)] as const);
  return {
    resultShown: new Map(views.map(([person, view]) => [person, view.result])),
    abortOffered: new Set(
      views.filter(([, view]) => view.abortOffered).map(([person]) => person)
    ),
    resignOffered: new Set(
      views.filter(([, view]) => view.resignOffered).map(([person]) => person)
    ),
  };
}
