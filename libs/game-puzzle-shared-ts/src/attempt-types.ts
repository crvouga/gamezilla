import { z } from 'zod';

export type ContentAttempt = {
  readonly id: string;
  readonly owner_id: string;
  readonly puzzle_id: string;
  readonly source_id: string;
  readonly game_id: string;
  readonly mode: 'ordinary' | 'playtest';
  readonly pack_revision_id: string | null;
  readonly current_position_id: string;
  readonly activity_order: number;
  readonly rules_version: number;
  readonly deleted_at: string | null;
  readonly updated_at: string;
};

export type AttemptPosition = {
  readonly id: string;
  readonly owner_id: string;
  readonly attempt_id: string;
  readonly parent_id: string | null;
  readonly history: string;
  readonly conflicted: boolean | 0 | 1;
  readonly deleted_at: string | null;
};

export type ContentCompletion = {
  readonly id: string;
  readonly owner_id: string;
  readonly puzzle_id: string;
  readonly puzzle_revision_id: string;
  readonly attempt_id: string;
  readonly position_id: string;
  readonly statistics: string;
  readonly deleted_at: string | null;
};

export const attemptCommandSchema = z.discriminatedUnion('kind', [
  z
    .object({ kind: z.literal('play'), action: z.string().max(65_536) })
    .strict(),
  z.object({ kind: z.literal('undo') }).strict(),
  z.object({ kind: z.literal('redo') }).strict(),
]);
export type AttemptCommand = z.infer<typeof attemptCommandSchema>;

/**
 * Entries record every accepted action. A state is kept for the first entry,
 * every `ATTEMPT_HISTORY_KEYFRAME`th entry and the cursor; any other position
 * is replayed from the keyframe before it. Many short moves then grow a saved
 * position linearly, not by a whole state per move. Histories that kept every
 * state remain readable.
 */
export const ATTEMPT_HISTORY_KEYFRAME = 32;

export const attemptHistorySchema = z
  .object({
    entries: z
      .array(
        z
          .object({
            action: z.string().nullable(),
            state: z.string().optional(),
          })
          .strict()
      )
      .min(1)
      .max(10_000),
    cursor: z.number().int().min(0).max(9_999),
  })
  .strict();
export type AttemptHistory = z.infer<typeof attemptHistorySchema>;

export function decodeAttemptHistory(text: string): AttemptHistory | null {
  try {
    const parsed = attemptHistorySchema.safeParse(JSON.parse(text));
    if (!parsed.success) return null;
    const { entries, cursor } = parsed.data;
    const replayable = entries.every(
      (entry, index) =>
        (index === 0 || entry.action !== null) &&
        (index % ATTEMPT_HISTORY_KEYFRAME !== 0 || entry.state !== undefined)
    );
    return replayable &&
      cursor < entries.length &&
      entries[cursor]?.state !== undefined
      ? parsed.data
      : null;
  } catch {
    return null;
  }
}
