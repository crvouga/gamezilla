import type {
  ContentJourneyBoard,
  ContentJourneyDevice,
} from '@libs/game-puzzle-harness-ts/content-journey-device';
import {
  contentInput,
  contentTap,
} from '@libs/game-puzzle-harness-ts/content-journey-device';

/** Driver reads between a choice and its rendered label; each is a round trip. */
const LABEL_READS = 100;

/**
 * `id`'s accessible label once it includes `expected`, or the last label read
 * when it never did, so a failure says what the cell shows instead.
 */
async function labelBecomes(
  device: ContentJourneyDevice,
  id: string,
  expected: string
): Promise<{ readonly ok: boolean; readonly label: string | null }> {
  let label: string | null = null;
  for (let read = 0; read < LABEL_READS; read += 1) {
    label = await device.ui.get(id).attribute('aria-label');
    if (label?.includes(expected)) return { ok: true, label };
  }
  return { ok: false, label };
}

/**
 * A resize shows its new size before its draft save settles, and a save that
 * settles after the next edit can replace it, so each edit waits for the save.
 */
async function draftSaved(device: ContentJourneyDevice): Promise<void> {
  await device.ui
    .get('content-draft-save-status')
    .expect.text('Saved on this device.', { ...device, exact: false });
}

async function edit(device: ContentJourneyDevice): Promise<void> {
  const columns = device.ui.get('numberlink-columns-value');
  await columns.key('arrowUp');
  await columns.expect.text('4', device);
  await draftSaved(device);
  await columns.key('arrowDown');
  await columns.expect.text('3', device);
  await draftSaved(device);
  await contentTap(device, 'numberlink-board-cell-1');
  const moved = await labelBecomes(
    device,
    'numberlink-board-cell-1',
    'endpoint 1'
  );
  if (!moved.ok) {
    const first = await device.ui
      .get('numberlink-board-cell-0')
      .attribute('aria-label');
    throw new Error(
      `Choosing an empty cell did not move the selected endpoint (cell 1 reads ${JSON.stringify(moved.label)}, cell 0 reads ${JSON.stringify(first)})`
    );
  }
  await draftSaved(device);
  await contentTap(device, 'numberlink-move-first');
  await contentTap(device, 'numberlink-board-cell-0');
  await contentInput(device, 'numberlink-pair-label', 'A');
}

async function preview(device: ContentJourneyDevice): Promise<void> {
  await device.ui.get('numberlink-board').expect.visible(device);
  const first = await device.ui
    .get('numberlink-board-cell-0')
    .attribute('aria-label');
  const last = await device.ui
    .get('numberlink-board-cell-2')
    .attribute('aria-label');
  if (!first?.includes('endpoint A') || !last?.includes('endpoint A'))
    throw new Error(
      'The preview did not keep the visually edited endpoint label'
    );
}

export async function drawNumberlinkJourneyRow(
  device: ContentJourneyDevice,
  row: number
): Promise<void> {
  const first = row * 3;
  await device.ui.get(`numberlink-board-cell-${first}`).wait('enabled', device);
  await device.ui.get(`numberlink-board-cell-${first}`).key('enter');
  await device.ui.get(`numberlink-board-cell-${first}`).key('arrowRight');
  await device.ui.get(`numberlink-board-cell-${first + 1}`).key('arrowRight');
  await device.ui.get(`numberlink-board-cell-${first + 2}`).key('enter');
  await device.ui
    .get('content-position-save-status')
    .expect.text('Progress saved on this device.', { ...device, exact: false });
}

async function solve(device: ContentJourneyDevice): Promise<void> {
  for (const row of [0, 1, 2]) await drawNumberlinkJourneyRow(device, row);
}

/** A real visual editor and keyboard player, with no Numberlink rule approximation. */
export const NUMBERLINK_JOURNEY_BOARD: ContentJourneyBoard = {
  edit,
  preview,
  solve,
};

export async function observeNumberlinkJourneyRow(
  device: ContentJourneyDevice,
  row: number,
  connected: boolean
): Promise<void> {
  const label = await device.ui
    .get(`numberlink-board-cell-${row * 3 + 1}`)
    .attribute('aria-label');
  const expected = connected ? 'connected' : 'empty';
  if (!label?.includes(expected))
    throw new Error(
      `Numberlink row ${row + 1} did not keep its ${expected} drawing`
    );
}
