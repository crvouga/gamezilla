import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

/** The rider names in seat order; a rider's index on the arena is its seat. */
export const LIGHT_CYCLES_RIDER_NAMES = [
  'Comet',
  'Ember',
  'Nova',
  'Volt',
] as const;
export type LightCyclesRiderName = (typeof LIGHT_CYCLES_RIDER_NAMES)[number];
export type LightCyclesDirection = 'up' | 'right' | 'down' | 'left';

const SEATS = ['white', 'black', 'red', 'blue'] as const;
const CUSTOM_BOARD = 'custom-game-board';
const MATCH_BOARD = 'multiplayer-board';

/** A cell as the specs count it: column and row from 1. */
export type LightCyclesCell = { readonly column: number; readonly row: number };

export type LightCyclesRiderShown = LightCyclesCell & {
  readonly name: LightCyclesRiderName;
  readonly heading: LightCyclesDirection;
  readonly next: LightCyclesDirection;
  readonly riding: boolean;
  readonly steeredHere: boolean;
  readonly mark: string;
  readonly trail: readonly string[];
  readonly score: number;
};

export type LightCyclesBoardShown = {
  readonly board: string;
  readonly riders: readonly LightCyclesRiderShown[];
  readonly round: number;
  /** countdown, running, round-over or completed. */
  readonly phase: string;
  readonly targetScore: number;
  /** Why this device can or cannot steer its first rider. */
  readonly steering: string;
  readonly overlay: string;
  readonly crashes: readonly string[];
};

export function cellName(cell: LightCyclesCell): string {
  return `${String(cell.column)},${String(cell.row)}`;
}

/** The board this device shows: a custom game's or a found game's. */
export async function lightCyclesBoardId(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  const ui = await actorUi(s, actor);
  if (await ui.get(`${MATCH_BOARD}-arena`).isVisible()) return MATCH_BOARD;
  if (await ui.get(`${CUSTOM_BOARD}-arena`).isVisible()) return CUSTOM_BOARD;
  return null;
}

/** `M{x} {y}h{n}v1h{-n}z` runs of the drawn trail, as the cells they cover. */
function trailCells(d: string | null): string[] {
  const cells: string[] = [];
  for (const run of (d ?? '').matchAll(/M(\d+) (\d+)h(\d+)/g)) {
    const [x, y, length] = [Number(run[1]), Number(run[2]), Number(run[3])];
    for (let at = 0; at < length; at++)
      cells.push(cellName({ column: x + at + 1, row: y + 1 }));
  }
  return cells;
}

async function number(ui: Driver, id: string, name: string): Promise<number> {
  return Number(await ui.get(id).attribute(name));
}

async function riderShown(
  ui: Driver,
  board: string,
  index: number
): Promise<LightCyclesRiderShown> {
  const head = ui.get(`${board}-arena-rider-${String(index)}`);
  const score = ui.get(`${board}-score-${SEATS[index]!}`);
  return {
    name: LIGHT_CYCLES_RIDER_NAMES[index]!,
    column: Number(await head.attribute('data-x')) + 1,
    row: Number(await head.attribute('data-y')) + 1,
    heading: (await head.attribute('data-heading')) as LightCyclesDirection,
    next: (await head.attribute('data-next')) as LightCyclesDirection,
    riding: (await head.attribute('data-alive')) === 'true',
    steeredHere: (await head.attribute('data-controlled')) === 'true',
    mark: (await head.attribute('data-mark')) ?? '',
    trail: trailCells(
      await ui.get(`${board}-arena-trail-${String(index)}`).attribute('d')
    ),
    score: Number(await score.attribute('data-score')),
  };
}

/** Everything a person sees of the arena, the score and the round on their device. */
export async function lightCyclesBoard(
  s: ProductHarness,
  actor = 'alice'
): Promise<LightCyclesBoardShown | null> {
  await bringToFront(s, actor);
  const board = await lightCyclesBoardId(s, actor);
  if (board === null) return null;
  const ui = await actorUi(s, actor);
  const count = await number(ui, `${board}-arena`, 'data-rider-count');
  const riders: LightCyclesRiderShown[] = [];
  for (let index = 0; index < count; index++)
    riders.push(await riderShown(ui, board, index));
  const crashes: string[] = [];
  for (let index = 0; index < count; index++) {
    const crash = ui.get(`${board}-arena-crash-${String(index)}`);
    if (await crash.isVisible())
      crashes.push(
        `${LIGHT_CYCLES_RIDER_NAMES[index]!}@${cellName({
          column: Number(await crash.attribute('data-x')) + 1,
          row: Number(await crash.attribute('data-y')) + 1,
        })}`
      );
  }
  const round = ui.get(`${board}-round`);
  return {
    board,
    riders,
    round: Number(await round.attribute('data-round')),
    phase: (await round.attribute('data-phase')) ?? '',
    targetScore: Number(await round.attribute('data-target')),
    steering:
      (await ui.get(`${board}-status`).attribute('data-steering')) ?? '',
    overlay: (await ui.get(`${board}-arena-overlay`).text()) ?? '',
    crashes,
  };
}

/** The board, which must be shown. */
export async function lightCyclesBoardShown(
  s: ProductHarness,
  actor = 'alice'
): Promise<LightCyclesBoardShown> {
  const board = await lightCyclesBoard(s, actor);
  if (board === null) throw new Error(`${actor} sees no Light Cycles arena`);
  return board;
}

export async function lightCyclesRider(
  s: ProductHarness,
  name: LightCyclesRiderName,
  actor = 'alice'
): Promise<LightCyclesRiderShown> {
  const rider = (await lightCyclesBoardShown(s, actor)).riders.find(
    (shown) => shown.name === name
  );
  if (rider === undefined) throw new Error(`${actor} sees no ${name}`);
  return rider;
}
