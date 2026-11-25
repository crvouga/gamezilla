import type { ChessBoardProps } from '@pkgs/chess-board-root-shared-ts/chess-board-types';

/** Binding-side traceability; behavior remains defined by the linked specs. */
export const CHESSBOARD_CONTRACT_PROOFS = {
  fen: ['board-authority.feature'],
  fenSyncKey: [
    'board-authority.feature',
    'move-emission-supplied.contract.test.tsx',
  ],
  onMove: ['board-interaction.feature', 'move-emission.contract.test.tsx'],
  orientation: [
    'board-accessibility.feature',
    'board-geometry.contract.test.ts',
  ],
  size: ['board-options.feature', 'resize.contract.test.ts'],
  fitSquare: ['puzzle-first-rank.test.tsx', 'stories.checks.ts'],
  interactive: ['board-authority.feature'],
  sound: ['board-sound.feature', 'sound-lifecycle.contract.test.tsx'],
  coordinatePlacement: ['public-coordinates.contract.test.ts'],
  showCoordinates: ['board-options.feature'],
  showGuidance: ['board-guidance.test.tsx'],
  guidancePlacement: ['puzzle-first-rank.test.tsx', 'board-guidance.test.tsx'],
  highlightLastMove: ['board-options.feature'],
  lastMove: ['last-move-supplied.contract.test.ts'],
  highlightLegalMoves: [
    'board-options.feature',
    'accessibility.contract.test.ts',
  ],
  theme: ['board-options.feature', 'board-theme.test.ts'],
  dataSet: [
    'identifier.contract.test.tsx',
    'visual.contract.test.ts',
    'board-geometry.contract.test.ts',
  ],
  cellFeedback: ['board-annotations.feature'],
  cellHighlights: ['board-annotations.feature'],
  arrows: ['board-annotations.feature'],
  enableUserArrows: ['board-annotations.feature'],
  onUserArrowsChange: ['board-annotations.feature'],
  animations: ['board-motion.feature', 'special-frames.contract.test.ts'],
  animationDurationMs: [
    'board-motion.feature',
    'board-motion.test.ts',
    'motion-adapter.contract.test.tsx',
  ],
  premoves: ['board-premoves.feature'],
  autoPromoteQueen: ['board-promotion.feature'],
} satisfies Record<keyof ChessBoardProps, readonly [string, ...string[]]>;
