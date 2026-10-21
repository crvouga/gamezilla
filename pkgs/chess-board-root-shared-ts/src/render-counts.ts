/**
 * Dev-only paint instrumentation for chess-board layers. Enabled only when
 * {@link isChessBoardDevInstrumentation} is true at counter creation time.
 */

export type RenderLayer =
  | 'squares'
  | 'pieces'
  | 'arrows'
  | 'feedback'
  | 'ghost';

const LAYERS: readonly RenderLayer[] = [
  'squares',
  'pieces',
  'arrows',
  'feedback',
  'ghost',
];

function emptyCounts(): Record<RenderLayer, number> {
  return {
    squares: 0,
    pieces: 0,
    arrows: 0,
    feedback: 0,
    ghost: 0,
  };
}

export type RenderCounter = {
  bump(layer: RenderLayer): void;
  snapshot(): Readonly<Record<RenderLayer, number>>;
  reset(): void;
};

export function createRenderCounter(enabled: boolean): RenderCounter {
  const counts = emptyCounts();
  if (!enabled) {
    return {
      bump: (_layer: RenderLayer) => undefined,
      snapshot: () => counts,
      reset: () => undefined,
    };
  }
  return {
    bump(layer) {
      counts[layer] += 1;
    },
    snapshot() {
      return { ...counts };
    },
    reset() {
      for (const layer of LAYERS) counts[layer] = 0;
    },
  };
}

type ChessBoardDevGlobal = typeof globalThis & {
  __CHESS_BOARD_DEV__?: boolean;
};

/** True only in Vite/dev builds with the explicit board instrumentation flag. */
export function isChessBoardDevInstrumentation(): boolean {
  const g = globalThis as ChessBoardDevGlobal;
  const env = import.meta.env as { DEV?: boolean | string };
  const isDev = env.DEV === true || env.DEV === 'true';
  return isDev && g.__CHESS_BOARD_DEV__ === true;
}

const liveCounts = createRenderCounter(true);

/** Bump a layer counter when board instrumentation is enabled. */
export function bumpChessBoardRender(layer: RenderLayer): void {
  if (!isChessBoardDevInstrumentation()) return;
  liveCounts.bump(layer);
}

export function chessBoardRenderSnapshot(): Readonly<
  Record<RenderLayer, number>
> {
  return liveCounts.snapshot();
}

export function resetChessBoardRenderCounts(): void {
  liveCounts.reset();
}
