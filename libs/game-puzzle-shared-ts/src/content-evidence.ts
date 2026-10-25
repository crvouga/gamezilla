import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import {
  PUZZLE_EVIDENCE_ACTION_LIMIT,
  type PuzzleContent,
  type PuzzleEvidence,
  replayPuzzleEvidence,
} from '@pkgs/turn-game-shared-ts/puzzle-content';
import { z } from 'zod';
import { attemptHistoryActions } from './attempt-history';
import type { AttemptHistory, ContentAttempt } from './attempt-types';

/**
 * Publication evidence is a record of accepted actions under one rules
 * version. It is never trusted: every use replays it through the game's
 * rules against the exact definition being checked.
 */
const storedEvidenceSchema = z
  .object({
    rulesVersion: z.number().int().positive(),
    actions: z.array(z.string().max(65_536)).max(PUZZLE_EVIDENCE_ACTION_LIMIT),
  })
  .strict();

export function encodeContentEvidence(
  game: PuzzleContent,
  evidence: PuzzleEvidence
): string {
  return JSON.stringify({
    rulesVersion: game.rulesVersion,
    actions: evidence.actions,
  });
}

/** Replays one record; `null` when it is unreadable, stale or not accepted. */
export function replayContentEvidence(
  game: PuzzleContent,
  definition: string,
  encoded: string | null
): PuzzleEvidence | null {
  if (encoded === null) return null;
  try {
    const parsed = storedEvidenceSchema.safeParse(JSON.parse(encoded));
    if (!parsed.success || parsed.data.rulesVersion !== game.rulesVersion)
      return null;
    const replay = replayPuzzleEvidence(
      game.rules,
      definition,
      parsed.data.actions
    );
    return replay.valid ? replay.evidence : null;
  } catch {
    // Earlier drafts kept a claimed final state, which is not evidence.
    return null;
  }
}

/**
 * A playtest proves only the definition it played, under the rules it was
 * played with. Its accepted actions are replayed again here; its saved state
 * is never taken on trust.
 */
export function playtestEvidence(args: {
  readonly game: PuzzleContent;
  readonly attempt: ContentAttempt;
  readonly documentId: string;
  readonly playedDefinition: string;
  readonly definition: string;
  readonly history: AttemptHistory;
}): PuzzleEvidence {
  const { game, attempt } = args;
  const refuse = (message: string): never => {
    throw new MutationError('PUZZLE_PLAYTEST_UNAVAILABLE', message);
  };
  if (attempt.mode !== 'playtest' || attempt.puzzle_id !== args.documentId)
    refuse('Choose a playtest of this puzzle as its proof.');
  if (attempt.rules_version !== game.rulesVersion)
    refuse(
      'This playtest used earlier rules. Complete a new playtest before publication.'
    );
  if (args.playedDefinition !== args.definition)
    refuse(
      'The puzzle changed after this playtest. Complete a playtest of this version before publication.'
    );
  const replay = replayPuzzleEvidence(
    game.rules,
    args.definition,
    attemptHistoryActions(args.history)
  );
  if (!replay.valid)
    return refuse(
      replay.issues[0]?.message ??
        'This playtest cannot be replayed. Complete a new playtest.'
    );
  return replay.evidence;
}
