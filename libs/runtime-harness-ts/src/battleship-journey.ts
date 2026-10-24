/**
 * What the two people of a Battleship journey saw of each other's fleet,
 * read off each device's screen alone, so the same read runs on the
 * simulated app and on a real browser against a deployed environment.
 */

import {
  type BattleshipBoardsShown,
  boardsShownIn,
  fleetSeenBeyondShots,
  fleetShown,
  wholeFleetShown,
} from '@libs/battleship-harness-ts/battleship-boards-shown';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import {
  publicJourneyCaption,
  publicJourneyText,
  publicJourneyVisible,
} from './journey-failure-context';
import { JOURNEY_WAIT_MS } from './journey-gestures';
import type { JourneyHost } from './journey-types';

type ScreenShown = {
  readonly html: string;
  readonly boards: BattleshipBoardsShown;
};

async function screenShown(ui: Driver): Promise<ScreenShown> {
  await ui
    .get(Handles.multiplayerBoard)
    .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
  const html = await ui.snapshotHtml();
  const boards = boardsShownIn(html ?? '', Handles.multiplayerBoard);
  // Without the person's own fleet on screen there is nothing to compare.
  if (!wholeFleetShown(boards.own)) {
    const fleet = fleetShown(boards.own);
    const context = {
      boardPresent: await publicJourneyVisible(ui, Handles.multiplayerBoard),
      snapshotPresent: typeof html === 'string',
      htmlChars: html?.length ?? 0,
      ownCells: Object.keys(boards.own).length,
      targetCells: Object.keys(boards.target).length,
      ownShips: fleet.size,
      ownShipCells: [...fleet.values()].reduce(
        (count, cells) => count + cells.length,
        0
      ),
      caption: await publicJourneyCaption(
        ui,
        `${Handles.multiplayerBoard}-own-grid`
      ),
      status: await publicJourneyText(ui, `${Handles.multiplayerBoard}-status`),
    };
    throw new Error(
      `A Battleship screen does not show its own whole fleet; ${JSON.stringify(context)}`
    );
  }
  return { html: html ?? '', boards };
}

/**
 * How many things each person's screen shows of the other's fleet beyond
 * what their own shots found (see {@link fleetSeenBeyondShots}): counts
 * only, so a failure writes no cell of anyone's fleet to a log.
 */
export async function battleshipFleetsSeenBeyondShots(
  host: Pick<JourneyHost, 'act' | 'actAsGuest'>
): Promise<{ readonly host: number; readonly guest: number }> {
  const read = new Map<'host' | 'guest', ScreenShown>();
  await host.act('readBattleshipScreen', async (ui) => {
    read.set('host', await screenShown(ui));
  });
  await host.actAsGuest('readBattleshipScreen', async (ui) => {
    read.set('guest', await screenShown(ui));
  });
  const a = read.get('host');
  const b = read.get('guest');
  if (a === undefined || b === undefined)
    throw new Error('A Battleship screen is unread');
  return {
    host: fleetSeenBeyondShots({
      viewerHtml: a.html,
      viewer: a.boards,
      rivalOwn: b.boards.own,
    }),
    guest: fleetSeenBeyondShots({
      viewerHtml: b.html,
      viewer: b.boards,
      rivalOwn: a.boards.own,
    }),
  };
}
