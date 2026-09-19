/**
 * Page object for the chess board harness. Authors speak squares and intents
 * ("drag e2 to e4", "pick a knight"); the driver only receives test ids and
 * x/y ratios. Reads come from what the board exposes to a driver: the probe
 * (model state), the painted SVG layers (paint tokens) and the harness logs.
 */

import { expect } from 'bun:test';
import { squareCenter } from '@pkgs/chess-board-core/geometry';
import {
  CHESS_BOARD_LAYERS,
  type ChessBoardLayer,
  type ChessBoardPaint,
  type ChessBoardProbe,
  type ChessBoardPromotionChoice,
  chessBoardLayerTestId,
  chessBoardLiveRegionTestId,
  chessBoardProbeTestId,
  chessBoardPromotionTestId,
  chessBoardSquareTestId,
  parseChessBoardPaint,
  parseChessBoardProbe,
} from '@pkgs/chess-board-core/probe';
import type { Square } from '@pkgs/chess-board-core/types';
import type { Driver, DriverKey, TapPosition } from '@pkgs/ui-testing';

import {
  HARNESS_BOARD_TEST_ID,
  HarnessIds,
  type HarnessToggle,
} from '../harness/harness-config';
import type { ChessBoardHost } from './board-host';

export type BoardPaint = Readonly<
  Record<ChessBoardLayer, readonly ChessBoardPaint[]>
>;

export type EmittedMove = {
  readonly from: Square;
  readonly to: Square;
  readonly san: string | null;
  readonly promotion: string | null;
  readonly captured: string | null;
};

export type InvariantOptions = {
  readonly highlightLastMove?: boolean;
  readonly highlightLegalMoves?: boolean;
};

export class BoardPage {
  constructor(
    readonly ui: Driver,
    readonly host: ChessBoardHost,
    readonly testId: string = HARNESS_BOARD_TEST_ID
  ) {}

  // -- reads ---------------------------------------------------------------

  async probe(): Promise<ChessBoardProbe> {
    return parseChessBoardProbe(
      await this.ui.get(chessBoardProbeTestId(this.testId)).text()
    );
  }

  async layer(layer: ChessBoardLayer): Promise<readonly ChessBoardPaint[]> {
    const node = this.ui.get(chessBoardLayerTestId(this.testId, layer));
    return parseChessBoardPaint(await node.text().catch(() => ''));
  }

  /** Non-token text of the squares layer: the painted edge coordinates. */
  async coordinateText(): Promise<string> {
    const node = this.ui.get(chessBoardLayerTestId(this.testId, 'squares'));
    const raw = (await node.text().catch(() => '')) ?? '';
    return raw.replace(/\u27e6[^\u27e7]*\u27e7/g, '').replace(/\s+/g, '');
  }

  async paint(): Promise<BoardPaint> {
    const out: Partial<Record<ChessBoardLayer, readonly ChessBoardPaint[]>> =
      {};
    for (const layer of CHESS_BOARD_LAYERS)
      out[layer] = await this.layer(layer);
    return out as BoardPaint;
  }

  /** Painted pieces as `code@square`, sorted (ghosts excluded). */
  async paintedPieces(): Promise<readonly string[]> {
    return (await this.layer('pieces'))
      .filter((t) => t.startsWith('piece:'))
      .map((t) => t.slice('piece:'.length));
  }

  async moves(): Promise<readonly EmittedMove[]> {
    return JSON.parse(
      (await this.ui.get(HarnessIds.moves).text()) ?? '[]'
    ) as EmittedMove[];
  }

  async sounds(): Promise<readonly string[]> {
    return JSON.parse(
      (await this.ui.get(HarnessIds.sounds).text()) ?? '[]'
    ) as string[];
  }

  async userArrows(): Promise<readonly unknown[]> {
    return JSON.parse(
      (await this.ui.get(HarnessIds.userArrows).text()) ?? '[]'
    ) as unknown[];
  }

  async spoken(): Promise<string> {
    return (
      (await this.ui.get(chessBoardLiveRegionTestId(this.testId)).text()) ?? ''
    );
  }

  async isPresent(): Promise<boolean> {
    return this.ui.get(this.testId).isVisible();
  }

  // -- gestures ------------------------------------------------------------

  /** Board-relative ratio of a square's center for the current orientation. */
  async ratioOf(square: Square): Promise<TapPosition> {
    const probe = await this.probe();
    const { x, y } = squareCenter(square, 8, probe.orientation);
    return { xRatio: x / 8, yRatio: y / 8 };
  }

  async tap(square: Square): Promise<void> {
    await this.ui.get(this.testId).tapAt(await this.ratioOf(square));
  }

  async tapAtRatio(position: TapPosition): Promise<void> {
    await this.ui.get(this.testId).tapAt(position);
  }

  async drag(from: Square, to: Square): Promise<void> {
    await this.ui
      .get(this.testId)
      .drag(await this.ratioOf(from), await this.ratioOf(to));
  }

  async dragToRatio(from: Square, to: TapPosition): Promise<void> {
    await this.ui.get(this.testId).drag(await this.ratioOf(from), to);
  }

  /** Right-click a square (user circle). */
  async rightClick(square: Square): Promise<void> {
    await this.ui
      .get(this.testId)
      .tapAt(await this.ratioOf(square), { button: 'secondary' });
  }

  /** Right-drag between squares (user arrow). */
  async rightDrag(from: Square, to: Square): Promise<void> {
    await this.ui
      .get(this.testId)
      .drag(await this.ratioOf(from), await this.ratioOf(to), {
        button: 'secondary',
      });
  }

  /** Tap sequence `from` then `to` (click-click move). */
  async clickMove(from: Square, to: Square): Promise<void> {
    await this.tap(from);
    await this.tap(to);
  }

  async key(key: DriverKey): Promise<void> {
    await this.ui.get(this.testId).key(key);
  }

  async promote(choice: ChessBoardPromotionChoice): Promise<void> {
    await this.ui.get(chessBoardPromotionTestId(this.testId, choice)).tap();
  }

  async promotionVisible(): Promise<boolean> {
    return this.ui.get(chessBoardPromotionTestId(this.testId, 'q')).isVisible();
  }

  async squareButtonVisible(square: Square): Promise<boolean> {
    return this.ui.get(chessBoardSquareTestId(this.testId, square)).isVisible();
  }

  // -- harness parent -----------------------------------------------------

  async next(): Promise<void> {
    await this.ui.get(HarnessIds.next).tap();
  }

  async reject(): Promise<void> {
    await this.ui.get(HarnessIds.reject).tap();
  }

  async flip(): Promise<void> {
    await this.ui.get(HarnessIds.flip).tap();
  }

  async toggle(name: HarnessToggle): Promise<void> {
    await this.ui.get(HarnessIds.toggle(name)).tap();
  }

  async toggleArrows(): Promise<void> {
    await this.ui.get(HarnessIds.toggleArrows).tap();
  }

  async remount(): Promise<void> {
    await this.ui.get(HarnessIds.remount).tap();
  }

  async unmount(): Promise<void> {
    await this.ui.get(HarnessIds.unmount).tap();
  }

  async settle(ms = 400): Promise<void> {
    await this.host.settle(ms);
  }

  // -- assertions ----------------------------------------------------------

  async expectFen(fen: string): Promise<void> {
    expect((await this.probe()).fen).toBe(fen);
  }

  async expectSounds(expected: readonly string[]): Promise<void> {
    await this.ui
      .get(HarnessIds.sounds)
      .expect.text(JSON.stringify(expected), { timeoutMs: 3_000 });
  }

  /**
   * The painted board agrees with the model: every piece is drawn on its
   * square (and nothing else is), and the square overlays / legal markers are
   * exactly what the selection, check, premove and last move call for.
   */
  async expectConsistent(options: InvariantOptions = {}): Promise<void> {
    const probe = await this.probe();
    const paint = await this.paint();
    expect(paint.pieces.filter((t) => t.startsWith('piece:'))).toEqual(
      probe.pieces.map((p) => `piece:${p.piece}@${p.square}`).sort()
    );
    expect(paint.squares.filter((t) => !t.startsWith('highlight'))).toEqual([
      ...expectedSquarePaint(probe, options),
    ]);
  }
}

function kingSquare(probe: ChessBoardProbe): Square | null {
  const king = probe.pieces.find((p) => p.piece === `${probe.turn}k`);
  return king?.square ?? null;
}

/** Square-layer tokens the model calls for (overlay precedence + markers). */
export function expectedSquarePaint(
  probe: ChessBoardProbe,
  options: InvariantOptions
): readonly string[] {
  const overlays = new Map<Square, string>();
  const put = (square: Square | null | undefined, kind: string) => {
    if (square === null || square === undefined) return;
    if (!overlays.has(square)) overlays.set(square, kind);
  };
  put(probe.selected, 'selected');
  if (probe.inCheck) put(kingSquare(probe), 'check');
  const premove = probe.premoves[0];
  put(premove?.from, 'premove');
  put(premove?.to, 'premove');
  if (options.highlightLastMove !== false) {
    put(probe.lastMove?.from, 'last-move');
    put(probe.lastMove?.to, 'last-move');
  }
  const out = [...overlays].map(([square, kind]) => `${kind}@${square}`);
  if (options.highlightLegalMoves !== false) {
    const occupied = new Set(probe.pieces.map((p) => p.square));
    for (const target of probe.legalTargets) {
      out.push(`${occupied.has(target) ? 'ring' : 'dot'}@${target}`);
    }
  }
  return out.sort();
}

export async function openBoard(
  host: ChessBoardHost,
  config: Parameters<ChessBoardHost['open']>[0]
): Promise<BoardPage> {
  const ui = await host.open(config);
  const page = new BoardPage(ui, host, config.testId);
  await ui.get(page.testId).expect.visible({ timeoutMs: 10_000 });
  return page;
}
