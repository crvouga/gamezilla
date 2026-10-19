import {
  inActiveCustomGame,
  readCustomGameScreen,
} from '@libs/game-session-harness/custom-game-screen';
import { configureCustomGame } from '@libs/game-session-harness/custom-game-ui';
import { showCustomGames } from '@libs/game-session-harness/game-navigation';
import { scenarioAction } from '@libs/harness/actor-ui';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import type { ProductHarness } from '@libs/harness/harness';
import { createSpace, joinViaLink } from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import { CHESS_GAME_ID } from './chess-playable';

/**
 * The space `host` hosts, with its Custom Game on screen: a new person who
 * signs in and starts it the first time.
 */
async function hostCustomGameSpace(
  s: ProductHarness,
  host: string
): Promise<string> {
  if (!s.actors.has(host)) {
    await Promise.resolve(signInWithGoogle.act(s, host));
    await Promise.resolve(createSpace.act(s, host));
  }
  const link = await readSpaceLink(s, host);
  if (link === null) throw new Error(`${host} is not in the space they host`);
  await showCustomGames(s, host, CHESS_GAME_ID);
  return link;
}

/** `host` sets up a game against a bot with White open; `actor` takes White. */
async function startWithActorAsWhite(
  s: ProductHarness,
  host: string,
  actor: string
): Promise<void> {
  const status = (await readCustomGameScreen(s, host))?.current?.status;
  if (status === undefined || status === 'completed' || status === 'cancelled')
    await configureCustomGame(s, host, { operation: 'create' });
  await configureCustomGame(s, host, { operation: 'open', side: 'white' });
  await configureCustomGame(s, host, { operation: 'bot', side: 'black' });
  await configureCustomGame(s, actor, { operation: 'claim', side: 'white' });
  await configureCustomGame(s, actor, { operation: 'ready' });
  await configureCustomGame(s, host, { operation: 'start' });
}

/**
 * `actor` becomes White in an active Custom Game against a bot in the space
 * `host` hosts, or, with `active` false, `host` cancels that game — through
 * the Custom Game screen, as people would. The game is in another person's
 * space, so the space `actor`'s person hosts keeps showing what it showed.
 * A person already in the asked state changes nothing.
 */
export const setCustomGameParticipation = scenarioAction({
  name: 'setCustomGameParticipation',
  act: async (s, actor: string, host: string, active: boolean) => {
    const link = await hostCustomGameSpace(s, host);
    if ((await readSpaceLink(s, actor)) !== link)
      await Promise.resolve(joinViaLink.act(s, actor, link));
    await showCustomGames(s, actor, CHESS_GAME_ID);
    if ((await inActiveCustomGame(s, actor)) === active) return;
    if (active) await startWithActorAsWhite(s, host, actor);
    else await configureCustomGame(s, host, { operation: 'cancel' });
  },
});
