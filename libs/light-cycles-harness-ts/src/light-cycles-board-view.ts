import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';

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
  /** The live game reaches this device; otherwise the arena dims as reconnecting. */
  readonly live: boolean;
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

/** The round clock and its connection indicator, independent of the riding field. */
export async function lightCyclesRound(s: ProductHarness, actor: string) {
  await bringToFront(s, actor);
  const board = await lightCyclesBoardId(s, actor);
  if (!board) return null;
  return readRound(await actorUi(s, actor), board);
}

export async function readRound(
  ui: { get(id: string): { attribute(name: string): Promise<string | null> } },
  board: string
) {
  const shown = ui.get(`${board}-round`);
  const round = await shown.attribute('data-round');
  const phase = await shown.attribute('data-phase');
  const dimmed = await ui.get(`${board}-arena`).attribute('data-dimmed');
  return { round: Number(round), phase, live: dimmed !== 'true' };
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

/** The opening tag of the element `testId` names, as the page serialized it. */
function tagOf(html: string, testId: string): string | null {
  const id = testId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.match(new RegExp(`<[^>]*\\sdata-testid="${id}"[^>]*>`))?.[0] ?? null;
}

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  quot: '"',
  apos: "'",
  lt: '<',
  gt: '>',
};

/** One attribute of a serialized tag, decoded; `null` when it is absent. */
function attributeOf(tag: string | null, name: string): string | null {
  const value = tag?.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
  if (value === undefined) return null;
  return value.replace(
    /&(amp|quot|apos|lt|gt|#39);/g,
    (_, entity: string) => (entity === '#39' ? "'" : ENTITIES[entity]!)
  );
}

type BoardFacts = Omit<LightCyclesBoardShown, 'overlay'>;

/**
 * The arena, the riders, the score and the round from one serialized page:
 * one moment of the game. Reading each attribute on its own took a native
 * browser one round trip apiece, so a four-rider board took longer than a
 * countdown, and the round read last no longer matched the riders read
 * first. `null` when the page shows no such arena.
 */
// regression: light-cycles-board-read-outlasts-countdown
export function lightCyclesBoardFacts(
  html: string,
  board: string
): BoardFacts | null {
  const tag = (id: string) => tagOf(html, `${board}-${id}`);
  const arena = tag('arena');
  if (arena === null) return null;
  const count = Number(attributeOf(arena, 'data-rider-count'));
  const riders: LightCyclesRiderShown[] = [];
  const crashes: string[] = [];
  for (let index = 0; index < count; index++) {
    const head = tag(`arena-rider-${String(index)}`);
    const name = LIGHT_CYCLES_RIDER_NAMES[index]!;
    riders.push({
      name,
      column: Number(attributeOf(head, 'data-x')) + 1,
      row: Number(attributeOf(head, 'data-y')) + 1,
      heading: attributeOf(head, 'data-heading') as LightCyclesDirection,
      next: attributeOf(head, 'data-next') as LightCyclesDirection,
      riding: attributeOf(head, 'data-alive') === 'true',
      steeredHere: attributeOf(head, 'data-controlled') === 'true',
      mark: attributeOf(head, 'data-mark') ?? '',
      trail: trailCells(
        attributeOf(tag(`arena-trail-${String(index)}`), 'd')
      ),
      score: Number(attributeOf(tag(`score-${SEATS[index]!}`), 'data-score')),
    });
    // A crash is drawn only once its rider has crashed.
    const crash = tag(`arena-crash-${String(index)}`);
    if (crash !== null)
      crashes.push(
        `${name}@${cellName({
          column: Number(attributeOf(crash, 'data-x')) + 1,
          row: Number(attributeOf(crash, 'data-y')) + 1,
        })}`
      );
  }
  const round = tag('round');
  return {
    board,
    riders,
    round: Number(attributeOf(round, 'data-round')),
    phase: attributeOf(round, 'data-phase') ?? '',
    targetScore: Number(attributeOf(round, 'data-target')),
    steering: attributeOf(tag('status'), 'data-steering') ?? '',
    crashes,
    live: attributeOf(arena, 'data-dimmed') !== 'true',
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
  const html = await ui.snapshotHtml();
  const facts = html === null ? null : lightCyclesBoardFacts(html, board);
  if (facts === null) return null;
  const result = ui.get(`${board}-result`);
  return {
    ...facts,
    // Countdown covers the arena; round and game results live in its status line.
    overlay:
      ((await result.isVisible())
        ? await result.text()
        : await ui.get(`${board}-arena-overlay`).text()) ?? '',
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
