import {
  defineCandidate,
  INTENT,
  type AssistantCandidate,
  type AssistantSignal,
  type DialogueLookupKey,
  type GameAdapter,
  type Intent,
  type PlayerView,
} from '@libs/assistant/shared';

import { CHESS_PUZZLE_SIGNAL } from './chess-puzzle-assistant-signals';

export type ChessPuzzleAssistantPayload = {
  readonly themes: readonly string[];
};

export { CHESS_PUZZLE_SIGNAL } from './chess-puzzle-assistant-signals';

const THEME_PRIORITY = [
  'mateIn1',
  'mateIn2',
  'mateIn3',
  'mateIn4',
  'mateIn5',
  'backRankMate',
  'fork',
  'pin',
  'skewer',
  'discoveredAttack',
  'doubleAttack',
  'hangingPiece',
  'sacrifice',
  'deflection',
  'attraction',
  'clearance',
  'interference',
  'xRayAttack',
  'zugzwang',
  'trappedPiece',
  'quietMove',
  'defensiveMove',
  'endgame',
  'opening',
  'middlegame',
] as const;

function pickDialogueTheme(themes: readonly string[]): string | undefined {
  if (themes.length === 0) return undefined;
  const themeSet = new Set(themes);
  for (const theme of THEME_PRIORITY) {
    if (themeSet.has(theme)) return theme;
  }
  return themes[0];
}

function signalToBucket(kind: string): string {
  switch (kind) {
    case CHESS_PUZZLE_SIGNAL.invalid:
      return 'invalid';
    case CHESS_PUZZLE_SIGNAL.start:
      return 'start';
    case CHESS_PUZZLE_SIGNAL.progress:
      return 'progress';
    case CHESS_PUZZLE_SIGNAL.wrong:
      return 'wrong';
    case CHESS_PUZZLE_SIGNAL.retry:
      return 'retry';
    case CHESS_PUZZLE_SIGNAL.solved:
      return 'solved';
    default:
      return 'fallback';
  }
}

function intentForBucket(bucket: string): Intent {
  switch (bucket) {
    case 'progress':
    case 'solved':
      return INTENT.praise;
    case 'wrong':
    case 'retry':
      return INTENT.encourage;
    case 'invalid':
    case 'fallback':
      return INTENT.transition;
    default:
      return INTENT.nudge;
  }
}

function weightFor(player: PlayerView, bucket: string): number {
  const base = bucket === 'solved' ? 60 : bucket === 'wrong' ? 50 : 42;
  return base + player.frustration() * 28;
}

function costForBucket(bucket: string): number {
  switch (bucket) {
    case 'solved':
      return 16;
    case 'wrong':
      return 12;
    case 'retry':
      return 11;
    case 'invalid':
      return 10;
    default:
      return 14;
  }
}

function cooldownForBucket(bucket: string): number {
  switch (bucket) {
    case 'solved':
      return 5000;
    case 'wrong':
      return 2800;
    case 'retry':
      return 2600;
    case 'invalid':
      return 6000;
    case 'progress':
      return 3200;
    default:
      return 4500;
  }
}

function dialogueKeyFor(
  bucket: string,
  theme: string | undefined
): DialogueLookupKey {
  return theme === undefined ? { bucket } : { bucket, theme };
}

function payloadRefFor(bucket: string, theme: string | undefined): string {
  const themeKey = theme ?? '__default__';
  return `assistant.chess.puzzle.${bucket}.${themeKey}`;
}

export function createChessPuzzleGameAdapter(): GameAdapter<ChessPuzzleAssistantPayload> {
  return {
    proposeCandidates(
      signal: AssistantSignal<ChessPuzzleAssistantPayload>,
      player: PlayerView
    ): readonly AssistantCandidate[] {
      const theme = pickDialogueTheme(signal.payload.themes);
      const bucket = signalToBucket(signal.kind);
      const dialogueKey = dialogueKeyFor(bucket, theme);
      const themeTag = theme ?? 'generic';
      return [
        defineCandidate({
          intent: intentForBucket(bucket),
          weight: weightFor(player, bucket),
          cost: costForBucket(bucket),
          cooldownMs: cooldownForBucket(bucket),
          payloadRef: payloadRefFor(bucket, theme),
          dialogueKey,
          tags: [bucket, themeTag],
        }),
      ];
    },
  };
}
