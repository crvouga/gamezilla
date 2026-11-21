import type { CustomGameSide } from '@libs/game-session-shared-ts/custom-game-state';
import { actorPage } from '@libs/harness-ts/actor-page';
import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';
import { readCustomGameProbe } from './custom-game-probe';
import { harnessGameAt } from './harness-game-of';

/**
 * What the lineup a listener hears (`custom-game-status`: `White: avery.
 * Black: Bot (medium).`) calls whoever holds `side`, or `null` without one.
 */
async function lineupName(
  s: ProductHarness,
  actor: string,
  side: CustomGameSide
): Promise<string | null> {
  const game = (await readCustomGameProbe(s, actor))?.current;
  if (game == null) return null;
  const presentation = harnessGameAt(s, game.fen).client.presentation;
  if (presentation === undefined) return null;
  const page = await actorPage(s, actor);
  const heard =
    page.querySelector('[data-testid="custom-game-status"]')?.textContent ?? '';
  const at = game.sides.indexOf(side);
  const label = `${presentation.sideLabel(side)}: `;
  const start = heard.indexOf(label);
  if (at < 0 || start < 0) return null;
  const next = game.sides[at + 1];
  const rest = heard.slice(start + label.length);
  const end =
    next === undefined
      ? rest.search(/\.(\s|$)/)
      : rest.indexOf(`. ${presentation.sideLabel(next)}: `);
  return end < 0 ? null : rest.slice(0, end);
}

/**
 * What the seat of `side` calls whoever holds it on the person's screen:
 * the seat's own name where the board's seats show it, else (while the
 * game is set up, where the viewer's own seat reads "You") the name the
 * lineup gives it.
 */
export async function readCustomGameName(
  s: ProductHarness,
  actor: string,
  side: CustomGameSide
): Promise<string | null> {
  const ui = await actorUi(s, actor);
  await bringToFront(s, actor);
  const seat = ui.get(`custom-game-${side}-person`);
  if (await seat.isVisible()) return seat.text();
  return lineupName(s, actor, side);
}
