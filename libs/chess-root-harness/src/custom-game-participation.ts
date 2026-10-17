import { openCustomGameScreen } from '@libs/chess-custom-game-harness/custom-game-screen';
import {
  configureCustomGame,
  readCustomGameProbe,
} from '@libs/game-session-harness/custom-game-ui';
import {
  customGameActiveParticipant,
  customGameTerminal,
} from '@libs/game-session-shared/custom-game-state';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import { createSpace, joinViaLink } from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';

/** How long a person who just joined waits for the space to show chess. */
const ARRIVAL_MS = 30_000;

/**
 * A person who joined the space follows its host to chess, then opens the
 * Custom Game, once the space has caught up on their device.
 */
async function reachJoinedCustomGame(
  s: ProductHarness,
  actor: string
): Promise<void> {
  const ui = await actorUi(s, actor);
  await pollUntil(
    s,
    async () => {
      await bringToFront(s, actor);
      if (await ui.get('custom-game-status').isVisible()) return true;
      if (await ui.get('game-choice-custom-game').isVisible())
        await ui.get('game-choice-custom-game').tap();
      return null;
    },
    { maxMs: ARRIVAL_MS, description: `${actor} reaching the Custom Game` }
  );
}

/** Whether `actor` takes part in an active Custom Game in the space it shows. */
export async function inActiveCustomGame(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const probe = await readCustomGameProbe(s, actor);
  return probe !== null && customGameActiveParticipant(probe, probe.myId);
}

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
  await openCustomGameScreen(s, host);
  return link;
}

/** `host` sets up a game against a bot with White open; `actor` takes White. */
async function startWithActorAsWhite(
  s: ProductHarness,
  host: string,
  actor: string
): Promise<void> {
  const current = (await readCustomGameProbe(s, host))?.current ?? null;
  if (current === null || customGameTerminal(current))
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
    await reachJoinedCustomGame(s, actor);
    if ((await inActiveCustomGame(s, actor)) === active) return;
    if (active) await startWithActorAsWhite(s, host, actor);
    else await configureCustomGame(s, host, { operation: 'cancel' });
  },
});
