import { z } from 'zod';

export const contentId = z.string().min(1).max(160);
export const contentBodySchema = z
  .object({
    title: z.string().max(160),
    description: z.string().max(4_000),
    difficulty: z.string().max(80),
    /** A game-owned definition, or the shared pack definition. Never a solved state. */
    definition: z.string().max(65_536),
  })
  .strict();

export type ContentBody = z.infer<typeof contentBodySchema>;
export type ContentKind = 'puzzle' | 'pack';

export type ContentDocument = {
  readonly id: string;
  readonly owner_id: string;
  readonly game_id: string;
  readonly kind: ContentKind;
  readonly working_draft_id: string | null;
  readonly published_revision_id: string | null;
  readonly publication_count: number;
  readonly status: 'draft' | 'published' | 'withdrawn';
  readonly deleted_at: string | null;
};

/** The public head carries no working-copy identity or private edit timestamp. */
export type ContentPublication = Omit<
  ContentDocument,
  'working_draft_id' | 'published_revision_id' | 'status'
> & {
  readonly published_revision_id: string;
  readonly status: 'published' | 'withdrawn';
};

export type ContentDraft = {
  readonly id: string;
  readonly document_id: string;
  readonly owner_id: string;
  readonly parent_id: string | null;
  readonly title: string;
  readonly description: string;
  readonly difficulty: string;
  readonly definition: string;
  readonly conflicted: boolean;
  readonly validation_status: 'unchecked' | 'valid' | 'invalid';
  readonly validation_issues: string;
  readonly validation_solution: string | null;
  readonly deleted_at: string | null;
};

export type ContentDraftRow = Omit<ContentDraft, 'conflicted'> & {
  readonly conflicted: boolean | 0 | 1;
};

export function contentDraftOf(row: ContentDraftRow): ContentDraft {
  return {
    ...row,
    conflicted: row.conflicted === true || row.conflicted === 1,
  };
}

export type ContentRevision = {
  readonly id: string;
  readonly document_id: string;
  readonly owner_id: string;
  readonly game_id: string;
  readonly kind: ContentKind;
  readonly edition: number;
  readonly title: string;
  readonly description: string;
  readonly difficulty: string;
  readonly definition: string;
  readonly rules_version: number;
  readonly deleted_at: string | null;
};

export const packDefinitionSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            puzzleId: contentId,
            revisionId: contentId.nullable(),
          })
          .strict()
      )
      .max(1_000),
  })
  .strict();
export type PackDefinition = z.infer<typeof packDefinitionSchema>;

export function contentBody(draft: ContentBody): ContentBody {
  return {
    title: draft.title,
    description: draft.description,
    difficulty: draft.difficulty,
    definition: draft.definition,
  };
}
