import { showGameSessions } from '@libs/game-session-harness-ts/game-navigation';
import {
  inActiveGameSession,
  readGameSessionScreen,
} from '@libs/game-session-harness-ts/game-session-screen';
import { configureGameSession } from '@libs/game-session-harness-ts/game-session-ui';
import { scenarioAction } from '@libs/harness-ts/actor-ui';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import {
  createSpace,
  joinViaLink,
} from '@libs/spaces-harness-ts/space-actions';
import { readSpaceLink } from '@libs/spaces-harness-ts/spaces-ui-reads';
import { CHESS_GAME_ID } from './chess-playable';

/**
 * The space `host` hosts, with its Game Session on screen: a new person who
 * signs in and starts it the first time.
 */
async function hostGameSessionSpace(
  s: ProductHarness,
  host: string
): Promise<string> {
  if (!s.actors.has(host)) {
    await Promise.resolve(signInWithGoogle.act(s, host));
    await Promise.resolve(createSpace.act(s, host));
  }
  const link = await readSpaceLink(s, host);
  if (link === null) throw new Error(`${host} is not in the space they host`);
  await showGameSessions(s, host, CHESS_GAME_ID);
  return link;
}

/** `host` sets up a game against a bot with White open; `actor` takes White. */
async function startWithActorAsWhite(
  s: ProductHarness,
  host: string,
  actor: string
): Promise<void> {
  const status = (await readGameSessionScreen(s, host))?.current?.status;
  if (status === undefined || status === 'completed' || status === 'cancelled')
    await configureGameSession(s, host, {
      operation: 'create',
      mode: 'vs-human',
    });
  await configureGameSession(s, host, { operation: 'open', side: 'white' });
  await configureGameSession(s, host, { operation: 'bot', side: 'black' });
  await configureGameSession(s, actor, { operation: 'claim', side: 'white' });
  await configureGameSession(s, actor, { operation: 'ready' });
  await configureGameSession(s, host, { operation: 'start' });
}

/**
 * `actor` becomes White in an active Game Session against a bot in the space
 * `host` hosts, or, with `active` false, `host` cancels that game — through
 * the Game Session screen, as people would. The game is in another person's
 * space, so the space `actor`'s person hosts keeps showing what it showed.
 * A person already in the asked state changes nothing.
 */
export const setGameSessionParticipation = scenarioAction({
  name: 'setGameSessionParticipation',
  act: async (s, actor: string, host: string, active: boolean) => {
    const link = await hostGameSessionSpace(s, host);
    if ((await readSpaceLink(s, actor)) !== link)
      await Promise.resolve(joinViaLink.act(s, actor, link));
    await showGameSessions(s, actor, CHESS_GAME_ID);
    if ((await inActiveGameSession(s, actor)) === active) return;
    if (active) await startWithActorAsWhite(s, host, actor);
    else await configureGameSession(s, host, { operation: 'cancel' });
  },
});
