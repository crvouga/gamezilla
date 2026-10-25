import type { AttemptLibrary } from './attempt-library';
import type { ContentAttempt } from './attempt-types';
import type { ContentLibrary } from './content-library';
import { decodePackDefinition } from './content-pack';

export type PackPuzzleProgress = {
  readonly puzzleId: string;
  readonly revisionId: string;
  readonly title: string;
  readonly status: 'unplayed' | 'in-progress' | 'completed';
  readonly attemptId: string | null;
};

function newer(a: ContentAttempt, b: ContentAttempt): number {
  if (a.activity_order !== b.activity_order)
    return b.activity_order - a.activity_order;
  if (a.updated_at !== b.updated_at)
    return a.updated_at < b.updated_at ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

export function packProgress(args: {
  readonly content: ContentLibrary;
  readonly play: AttemptLibrary;
  readonly packRevisionId: string;
}) {
  const pack = args.content.revisions.find(
    (edition) => edition.id === args.packRevisionId && edition.kind === 'pack'
  );
  const definition =
    pack === undefined ? null : decodePackDefinition(pack.definition);
  if (definition === null) return null;
  const completed = new Set(
    args.play.completions.map((completion) => completion.puzzle_revision_id)
  );
  const attempts = args.play.attempts
    .filter((attempt) => attempt.mode === 'ordinary')
    .toSorted(newer);
  const items: PackPuzzleProgress[] = definition.items.flatMap((item) => {
    const revision = args.content.revisions.find(
      (edition) => edition.id === item.revisionId
    );
    if (revision === undefined) return [];
    const attempt = attempts.find((entry) => entry.source_id === revision.id);
    return [
      {
        puzzleId: item.puzzleId,
        revisionId: revision.id,
        title: revision.title,
        status: completed.has(revision.id)
          ? 'completed'
          : attempt === undefined
            ? 'unplayed'
            : 'in-progress',
        attemptId: attempt?.id ?? null,
      },
    ];
  });
  // The last puzzle played in this pack, if unfinished; else the first unfinished.
  const active = attempts.find(
    (attempt) => attempt.pack_revision_id === args.packRevisionId
  );
  const next =
    (active === undefined || completed.has(active.source_id)
      ? undefined
      : items.find((item) => item.revisionId === active.source_id)) ??
    items.find((item) => item.status !== 'completed') ??
    null;
  const completedCount = items.filter(
    (item) => item.status === 'completed'
  ).length;
  return {
    items,
    completedCount,
    total: definition.items.length,
    complete:
      definition.items.length > 0 && completedCount === definition.items.length,
    next,
  };
}
