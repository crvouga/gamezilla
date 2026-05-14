import {
  defineCandidate,
  INTENT,
  type AssistantCandidate,
  type Intent,
  type PlayerView,
} from '@gamezilla/assistant/shared';

import {
  CHESS_PUZZLE_ANNOUNCE_REFS_BY_THEME,
  CHESS_PUZZLE_PROGRESS_REFS_BY_THEME,
  CHESS_PUZZLE_RETRY_REFS_BY_THEME,
  CHESS_PUZZLE_SOLVED_REFS_BY_THEME,
  CHESS_PUZZLE_START_REFS_BY_THEME,
  CHESS_PUZZLE_WRONG_REFS_BY_THEME,
  chessPuzzleFallbackRefs,
} from './chess-puzzle-assistant-payloads';

const BASE_WEIGHT = 42;
const ANNOUNCE_WEIGHT = 58;
const THEME_WEIGHT_BOOST = 10;

function weightFor(player: PlayerView, base: number): number {
  return base + player.frustration() * 28;
}

function refsForPhase(
  map: ReadonlyMap<string, readonly string[]>,
  theme: string | null,
  fallbackEvent: string
): readonly string[] {
  const themed = theme === null ? [] : (map.get(theme) ?? []);
  const generic = chessPuzzleFallbackRefs(fallbackEvent);
  return [...themed, ...generic];
}

function lineCandidates(args: {
  readonly refs: readonly string[];
  readonly intent: Intent;
  readonly baseWeight: number;
  readonly cost: number;
  readonly cooldownMs: number;
  readonly tags: readonly string[];
  readonly player: PlayerView;
}): AssistantCandidate[] {
  return args.refs.map((ref) =>
    defineCandidate({
      intent: args.intent,
      weight: weightFor(args.player, args.baseWeight),
      cost: args.cost,
      cooldownMs: args.cooldownMs,
      payloadRef: ref,
      tags: args.tags,
    })
  );
}

export function candidatesForInvalid(player: PlayerView): AssistantCandidate[] {
  return lineCandidates({
    refs: chessPuzzleFallbackRefs('invalid'),
    intent: INTENT.transition,
    baseWeight: BASE_WEIGHT,
    cost: 10,
    cooldownMs: 6000,
    tags: ['invalid'],
    player,
  });
}

export function candidatesForStart(
  theme: string | null,
  themeTag: string,
  player: PlayerView
): AssistantCandidate[] {
  const announceRefs =
    theme === null
      ? []
      : (CHESS_PUZZLE_ANNOUNCE_REFS_BY_THEME.get(theme) ?? []);
  const announce = announceRefs.map((ref) =>
    defineCandidate({
      intent: INTENT.announce,
      weight: ANNOUNCE_WEIGHT,
      cost: 22,
      cooldownMs: 14_000,
      payloadRef: ref,
      tags: ['start', 'announce', themeTag],
    })
  );
  const startRefs = refsForPhase(
    CHESS_PUZZLE_START_REFS_BY_THEME,
    theme,
    'start'
  );
  const start = lineCandidates({
    refs: startRefs,
    intent: INTENT.nudge,
    baseWeight: BASE_WEIGHT + THEME_WEIGHT_BOOST,
    cost: 14,
    cooldownMs: 4500,
    tags: ['start', themeTag],
    player,
  });
  return [...announce, ...start];
}

export function candidatesForProgress(
  theme: string | null,
  themeTag: string,
  player: PlayerView
): AssistantCandidate[] {
  return lineCandidates({
    refs: refsForPhase(CHESS_PUZZLE_PROGRESS_REFS_BY_THEME, theme, 'progress'),
    intent: INTENT.praise,
    baseWeight: BASE_WEIGHT + 6,
    cost: 12,
    cooldownMs: 3200,
    tags: ['progress', 'moveCorrect', themeTag],
    player,
  });
}

export function candidatesForWrong(
  theme: string | null,
  themeTag: string,
  player: PlayerView
): AssistantCandidate[] {
  return lineCandidates({
    refs: refsForPhase(CHESS_PUZZLE_WRONG_REFS_BY_THEME, theme, 'wrong'),
    intent: INTENT.encourage,
    baseWeight: BASE_WEIGHT + 8,
    cost: 12,
    cooldownMs: 2800,
    tags: ['wrong', themeTag],
    player,
  });
}

export function candidatesForRetry(
  theme: string | null,
  themeTag: string,
  player: PlayerView
): AssistantCandidate[] {
  return lineCandidates({
    refs: refsForPhase(CHESS_PUZZLE_RETRY_REFS_BY_THEME, theme, 'retry'),
    intent: INTENT.encourage,
    baseWeight: BASE_WEIGHT + 4,
    cost: 11,
    cooldownMs: 2600,
    tags: ['retry', themeTag],
    player,
  });
}

export function candidatesForSolved(
  theme: string | null,
  themeTag: string,
  player: PlayerView
): AssistantCandidate[] {
  return lineCandidates({
    refs: refsForPhase(CHESS_PUZZLE_SOLVED_REFS_BY_THEME, theme, 'solved'),
    intent: INTENT.praise,
    baseWeight: BASE_WEIGHT + 18,
    cost: 16,
    cooldownMs: 5000,
    tags: ['solved', themeTag],
    player,
  });
}
