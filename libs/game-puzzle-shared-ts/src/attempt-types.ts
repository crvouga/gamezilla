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

export const attemptHistorySchema = z
  .object({
    entries: z
      .array(
        z.object({ action: z.string().nullable(), state: z.string() }).strict()
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
    return parsed.success && parsed.data.cursor < parsed.data.entries.length
      ? parsed.data
      : null;
  } catch {
    return null;
  }
}
