/**
 * What a person sees of Hearts on their Custom Game screen: the custom game
 * as the screen shows it (who sits where, the moves, how it ended, what it
 * last refused), the Hearts table on the board (`hearts-table-shown`), the
 * badges beside each seat, and what someone listening hears. Nothing here
 * reads a hand the room holds or a stored row: a person's hand is what
 * their own board draws.
 */

import { CUSTOM_GAME_BOARD } from '@libs/game-session-harness-ts/custom-game-moves';
import {
  type CustomGameScreen,
  readCustomGameScreen,
} from '@libs/game-session-harness-ts/custom-game-screen';
import { actorPage } from '@libs/harness-ts/actor-page';
import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { actorHtml, bringToFront } from '@libs/harness-ts/observations';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  type HeartsTableShown,
  heartsTableShownIn,
} from './hearts-table-shown';

export type {
  HeartsCardShown,
  HeartsSeatShown,
  HeartsTableShown,
} from './hearts-table-shown';

const SIDES: readonly GameSide[] = ['white', 'black', 'red', 'blue'];

export type HeartsView = HeartsTableShown & {
  readonly screen: CustomGameScreen;
  /** The sides the screen marks as having made their secret choice. */
  readonly committed: readonly GameSide[];
  /** The sides the screen marks as played by a stand-in bot. */
  readonly standIns: readonly GameSide[];
  /** What the screen last refused, as the person reads it; '' when nothing. */
  readonly told: string;
  /** Everything else the page shows, as text: no hand of another may be in it. */
  readonly page: string;
};

async function shownText(
  s: ProductHarness,
  actor: string,
  testId: string
): Promise<string | null> {
  const node = (await actorUi(s, actor)).get(testId);
  return (await node.isVisible()) ? ((await node.text()) ?? '') : null;
}

async function badged(
  s: ProductHarness,
  actor: string,
  badge: string
): Promise<GameSide[]> {
  const shown: GameSide[] = [];
  for (const side of SIDES)
    if ((await shownText(s, actor, `custom-game-${side}-${badge}`)) !== null)
      shown.push(side);
  return shown;
}

/** The Hearts game `actor` sees now. */
export async function heartsView(
  s: ProductHarness,
  actor: string
): Promise<HeartsView> {
  await actorUi(s, actor);
  await bringToFront(s, actor);
  const screen = await readCustomGameScreen(s, actor);
  if (screen === null) throw new Error(`${actor} sees no Hearts game`);
  const html = (await actorHtml(s, actor)) ?? '';
  return {
    ...heartsTableShownIn(html, CUSTOM_GAME_BOARD),
    screen,
    committed: await badged(s, actor, 'committed'),
    standIns: await badged(s, actor, 'stand-in'),
    told: (await shownText(s, actor, 'custom-game-error')) ?? '',
    page: html,
  };
}

/**
 * What a person listening to the app hears of the game: every polite live
 * region on their page that assistive technology is not told to skip, in
 * page order.
 */
export async function heartsHeard(
  s: ProductHarness,
  actor: string
): Promise<string> {
  const page = await actorPage(s, actor);
  const regions = page.querySelectorAll(
    `[data-actor="${actor}"] [aria-live="polite"], [data-actor="${actor}"] [role="status"]`
  );
  return [...regions]
    .filter(
      (region) => region.closest('[aria-hidden="true"], [hidden]') === null
    )
    .map((region) => (region.textContent ?? '').trim())
    .filter((text) => text !== '')
    .join('\n');
}
