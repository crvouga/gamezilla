import { expect, test } from 'bun:test';
import { pressControlWithKeyboard } from '@libs/game-matchmaking-harness-ts/multiplayer-keyboard';
import { shownMultiplayerText } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import {
  givenGameSpace,
  openFindingAnOpponent,
  opponentSearchView,
} from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { actorHtml } from '@libs/harness-ts/observations';
import type { OpenHarness } from '@libs/harness-ts/open-harness';
import { nameEveryoneSeesOf } from '@libs/profile-harness-ts/profile-ui-reads';
import { gameSides } from '@pkgs/turn-game-shared-ts/game-rules';
import { agreed, command, matched } from './conformance/match-authority-world';
import { CONFORMANCE_GAMES, openConformanceHarness } from './conformance-world';

const FOUR_SEAT_GAME = CONFORMANCE_GAMES.find(
  (game) =>
    gameSides(game.shared.turnGame.rules).length === 4 &&
    game.shared.turnGame.capabilities.matchmaking !== undefined
);
if (FOUR_SEAT_GAME === undefined)
  throw new Error('No four-seat matching fixture');
const GAME = FOUR_SEAT_GAME;

async function playThrough(
  s: OpenHarness,
  people: readonly string[],
  actions: readonly string[]
) {
  for (const action of actions) {
    const game = await agreed(s, people);
    expect(
      await command(s, people[game.revision % 4]!, {
        gameId: game.id,
        revision: game.revision,
        requestId: `feedback-${game.revision}`,
        uci: action,
      })
    ).toBe(true);
  }
}

// regression: multiseat-named-announcement
test('a four-seat listener hears the active person and the actual winner', async () => {
  await using s = await openConformanceHarness('four-seat-named-announcement');
  const { people } = await matched(s, GAME);
  const listener = people[1]!;
  const first = people[0]!;
  const name = await s.read(nameEveryoneSeesOf, first);
  expect(name).toBeTruthy();
  await s.apply(openFindingAnOpponent, listener, GAME.shared.id);
  await s.until(
    (world) =>
      shownMultiplayerText(world, listener, 'multiplayer-announcement'),
    { pred: (text) => text?.includes(`${name}'s turn.`) === true }
  );
  await playThrough(s, people, GAME.fixtures.firstSideVictory);
  const finished = await agreed(s, people);
  expect(finished.outcome).toBe('white');
  await s.until(
    (world) =>
      shownMultiplayerText(world, listener, 'multiplayer-announcement'),
    {
      pred: (text) =>
        text?.includes(`${name} won the multiplayer game.`) === true,
    }
  );
  expect(
    await s.read(shownMultiplayerText, listener, 'multiplayer-new-opponent')
  ).toContain('New players');
}, 180_000);

// regression: multiseat-resign-confirmation
test('four-seat resign confirmation explains the draw that all players receive', async () => {
  await using s = await openConformanceHarness('four-seat-resign-confirmation');
  const { people } = await matched(s, GAME);
  await playThrough(s, people, GAME.fixtures.firstSideVictory.slice(0, 4));
  const leaving = people[1]!;
  await s.apply(openFindingAnOpponent, leaving, GAME.shared.id);
  await s.apply(
    pressControlWithKeyboard,
    leaving,
    GAME.shared.id,
    'multiplayer-resign'
  );
  expect(await s.read(actorHtml, leaving)).toContain(
    'The round will end in a draw for all players.'
  );
  await s.apply(
    pressControlWithKeyboard,
    leaving,
    GAME.shared.id,
    'multiplayer-confirm'
  );
  const finished = await agreed(s, people, (game) => game.outcome === 'draw');
  expect(finished.reason).toBe('participant withdrew');
}, 180_000);

// regression: multiseat-matchmaking-count
test('a four-seat search states its required group size before and while waiting', async () => {
  await using s = await openConformanceHarness('four-seat-matchmaking-count');
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(givenGameSpace, 'alice');
  await s.apply(openFindingAnOpponent, 'alice', GAME.shared.id);
  expect(
    await s.read(shownMultiplayerText, 'alice', 'multiplayer-find')
  ).toContain('Find players');
  expect(await s.read(actorHtml, 'alice')).toContain('4 players including you');
  await s.apply(
    pressControlWithKeyboard,
    'alice',
    GAME.shared.id,
    'multiplayer-find'
  );
  const queued = await s.until((world) => opponentSearchView(world, 'alice'), {
    pred: (view) => view.search?.standing === 'waiting',
  });
  expect(queued.game).toBeNull();
  const waiting = await s.read(
    shownMultiplayerText,
    'alice',
    'multiplayer-waiting'
  );
  expect(waiting).toContain('3 other players');
  expect(waiting).toContain('4 players including you');
  await s.apply(
    pressControlWithKeyboard,
    'alice',
    GAME.shared.id,
    'multiplayer-stop'
  );
}, 180_000);
