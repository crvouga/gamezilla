import {
  type ContentJourneyBoard,
  type ContentJourneyDevice,
  contentTap,
} from '@libs/game-puzzle-harness-ts/content-journey-device';

/**
 * A new draft's board: worker B3, a crate on C3 and a goal on E3 in a walled
 * room. The journey paints B2 as a wall, then solves with two pushes right.
 */
async function edit(device: ContentJourneyDevice): Promise<void> {
  await contentTap(device, 'sokoban-tool-wall');
  await contentTap(device, 'sokoban-square-B2');
  const label = await device.ui
    .get('sokoban-square-B2')
    .attribute('aria-label');
  if (!label?.includes('wall'))
    throw new Error('Painting B2 with the wall tool did not make it a wall');
  await device.ui.get('sokoban-ready').expect.visible(device);
}

/** The preview shows the painted wall: tile 7 is B2 on the six-column board. */
async function preview(device: ContentJourneyDevice): Promise<void> {
  await device.ui.get('sokoban-preview').expect.visible(device);
  const label = await device.ui
    .get('sokoban-preview-tile-7')
    .attribute('aria-label');
  if (label !== 'B2: wall')
    throw new Error(`The preview did not keep the painted wall: ${label}`);
}

/** One push right with the keyboard, kept before the next. */
export async function pushSokobanJourneyRight(
  device: ContentJourneyDevice
): Promise<void> {
  await device.ui.get('sokoban-board').key('arrowRight');
  await device.ui
    .get('content-position-save-status')
    .expect.text('Progress saved on this device.', { ...device, exact: false });
}

export async function observeSokobanJourneyCounts(
  device: ContentJourneyDevice,
  moves: number,
  pushes: number
): Promise<void> {
  await device.ui
    .get('sokoban-counts')
    .expect.text(`Moves: ${moves} · Pushes: ${pushes}`, device);
}

async function solve(device: ContentJourneyDevice): Promise<void> {
  await pushSokobanJourneyRight(device);
  await pushSokobanJourneyRight(device);
}

/** The real builder tools and keyboard player, with no Sokoban rule approximation. */
export const SOKOBAN_JOURNEY_BOARD: ContentJourneyBoard = {
  edit,
  preview,
  solve,
};
