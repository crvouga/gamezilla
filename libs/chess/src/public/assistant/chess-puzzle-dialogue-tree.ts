import type { DialogueTreeThemeSpec } from '@pkgs/assistant/shared';
import { defineDialogueTree } from '@pkgs/assistant/shared';

const CHESS_THEMES = [
  'fork',
  'pin',
  'skewer',
  'discoveredAttack',
  'doubleAttack',
  'hangingPiece',
  'backRankMate',
  'mateIn1',
  'mateIn2',
  'mateIn3',
  'attraction',
  'deflection',
  'clearance',
  'interference',
  'xRayAttack',
  'zugzwang',
  'trappedPiece',
  'endgame',
  'opening',
  'middlegame',
  'defensiveMove',
  'quietMove',
  'sacrifice',
] as const;

type ChessTheme = (typeof CHESS_THEMES)[number];

function single(...variants: readonly string[]): DialogueTreeThemeSpec {
  return variants;
}

function themeMap(
  build: (theme: ChessTheme) => readonly string[]
): Record<string, DialogueTreeThemeSpec> {
  const out: Record<string, DialogueTreeThemeSpec> = {};
  for (const theme of CHESS_THEMES) {
    out[theme] = build(theme);
  }
  return out;
}

function startLine(theme: ChessTheme): readonly string[] {
  switch (theme) {
    case 'mateIn1':
      return [
        'Checkmate is in the air. Can you find it?',
        'There is a mate here. Trust your instincts.',
      ];
    case 'mateIn2':
    case 'mateIn3':
      return [
        'The mate is in there. Take your time and hunt.',
        'A forcing line leads to mate. You can find it.',
      ];
    case 'backRankMate':
      return [
        'The back rank might be the key. Worth a look.',
        'Keep an eye on the back rank. Something is there.',
      ];
    case 'fork':
      return [
        'A fork is hiding in this position. Go find it.',
        'Two targets, one move. See if you can spot the fork.',
      ];
    case 'pin':
      return [
        'A pin could crack this open. Scan the lines.',
        'Something is tied down here. Find the pin.',
      ];
    case 'skewer':
      return [
        'A skewer might be the breakthrough. Keep looking.',
        'Attack through a piece. The skewer may be there.',
      ];
    case 'sacrifice':
      return [
        'Sometimes you give to get. Look for a sacrifice.',
        'A bold sacrifice may be the answer. Dare to look.',
      ];
    case 'hangingPiece':
      return [
        'A loose piece might be begging to be taken.',
        'Someone left something unguarded. Can you punish it?',
      ];
    default:
      return [
        'There is a strong idea in here. You can find it.',
        'Take a breath, scan the board, and trust yourself.',
      ];
  }
}

function wrongLine(theme: ChessTheme): readonly string[] {
  switch (theme) {
    case 'mateIn1':
    case 'mateIn2':
    case 'mateIn3':
      return [
        '{wrongFrom}-{wrongTo} is not the mate. Close, keep hunting.',
        'Not the mating move, but you are in the fight.',
      ];
    default:
      return [
        '{wrongFrom}-{wrongTo} misses. You are closer than you think.',
        'Not quite, but the right idea is still on the board.',
      ];
  }
}

function solvedLine(theme: ChessTheme): readonly string[] {
  switch (theme) {
    case 'fork':
      return [
        'You found the fork. Sharp eye.',
        'That fork was clean. Well played.',
      ];
    case 'pin':
      return [
        'You nailed the pin. Nicely done.',
        'Pinned and won. Great work.',
      ];
    case 'mateIn1':
    case 'mateIn2':
    case 'mateIn3':
      return [
        'Checkmate found. You saw it.',
        'That is the mate. Beautiful finish.',
      ];
    case 'backRankMate':
      return [
        'Back-rank mate. Crushing finish.',
        'You found the back-rank shot. Well done.',
      ];
    case 'sacrifice':
      return [
        'You found the sacrifice. Bold and right.',
        'Brave and correct. That sacrifice paid off.',
      ];
    default:
      return [
        'You cracked it. Really well done.',
        'That is the idea. On to the next one?',
      ];
  }
}

export const CHESS_PUZZLE_DIALOGUE_TREE = defineDialogueTree({
  start: {
    ...themeMap(startLine),
    __default__: single(
      'Something strong is hiding here. You can find it.',
      'Trust your eye. The idea is on the board.'
    ),
  },
  wrong: {
    ...themeMap(wrongLine),
    __default__: single(
      '{wrongFrom}-{wrongTo} misses. Stay with it, you are close.',
      'Not that one, but you are on the right track.'
    ),
  },
  retry: {
    __default__: single(
      'Fresh look. You have got this.',
      'Shake it off and scan again. It is still in there.'
    ),
  },
  solved: {
    ...themeMap(solvedLine),
    __default__: single(
      'You got it. Well played.',
      'That is the answer. Ready for another?'
    ),
  },
  invalid: {
    __default__: single(
      'That move is not legal. Try another square.',
      'Off the board rules-wise. Pick a legal move.'
    ),
  },
  fallback: {
    __default__: single(
      'Keep digging. The idea is still there.',
      'You are closer than it feels. Look once more.'
    ),
  },
});
