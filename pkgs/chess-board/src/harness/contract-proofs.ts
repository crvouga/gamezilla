import type { ChessBoardProps } from '../chess-board-types';

/** Binding-side traceability; behavior remains defined by the linked specs. */
export const CHESSBOARD_CONTRACT_PROOFS = {
  fen: ['board-authority.feature', 'board-lifecycle.qnt'],
  fenSyncKey: [
    'board-authority.feature',
    'move-emission-supplied.contract.test.tsx',
  ],
  onMove: ['board-interaction.feature', 'move-emission.contract.test.tsx'],
  orientation: [
    'board-accessibility.feature',
    'board-lifecycle.qnt',
    'board-geometry.contract.test.ts',
  ],
  size: [
    'board-options.feature',
    'board-options.qnt',
    'resize.contract.test.ts',
  ],
  interactive: ['board-authority.feature', 'board-options.qnt'],
  sound: [
    'board-sound.feature',
    'board-lifecycle.qnt',
    'sound-lifecycle.contract.test.tsx',
  ],
  showCoordinates: ['board-options.feature', 'board-options.qnt'],
  highlightLastMove: ['board-options.feature', 'board-options.qnt'],
  highlightLegalMoves: [
    'board-options.feature',
    'board-options.qnt',
    'accessibility.contract.test.ts',
  ],
  theme: ['board-options.feature', 'board-options.qnt', 'board-theme.test.ts'],
  dataSet: [
    'identifier.contract.test.tsx',
    'visual.contract.test.ts',
    'board-geometry.contract.test.ts',
  ],
  cellFeedback: ['board-annotations.feature', 'board-annotations.qnt'],
  cellHighlights: ['board-annotations.feature', 'board-annotations.qnt'],
  arrows: ['board-annotations.feature', 'board-annotations.qnt'],
  enableUserArrows: ['board-annotations.feature', 'board-annotations.qnt'],
  onUserArrowsChange: ['board-annotations.feature', 'board-annotations.qnt'],
  animations: [
    'board-motion.feature',
    'board-lifecycle.qnt',
    'special-frames.contract.test.ts',
  ],
  animationDurationMs: [
    'board-motion.feature',
    'board-lifecycle.qnt',
    'board-motion.test.ts',
    'motion-adapter.contract.test.tsx',
  ],
  premoves: ['board-premoves.feature', 'board-premoves.qnt'],
  autoPromoteQueen: ['board-promotion.feature', 'board-promotion.qnt'],
} satisfies Record<keyof ChessBoardProps, readonly [string, ...string[]]>;
