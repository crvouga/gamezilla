import type { ContentKind } from '@libs/game-puzzle-shared-ts/content-types';
import { useLingui } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';

/**
 * Where a piece of the person's content stands. A draft is still theirs
 * alone; published is out for everyone; withdrawn was taken back; an
 * attempt is in progress or completed; a playtest counts for nothing.
 */
export type ContentStatus =
  | 'draft'
  | 'published'
  | 'withdrawn'
  | 'in-progress'
  | 'completed'
  | 'playtest';

/**
 * One chip system for the library, three kinds kept apart by look: what a
 * thing is (Puzzle, Pack) is a plain neutral tag; how hard it is, a tag
 * tinted by how hard (`difficultyTint`); where it stands, a status tag led
 * by a dot in its own hue. A row never mixes them in one column of values.
 */
export function ContentKindChip(props: { kind: ContentKind }): JSX.Element {
  const { t } = useLingui();
  return (
    <Badge
      intent="neutral"
      label={props.kind === 'pack' ? t`Pack` : t`Puzzle`}
      dataSet={{ testid: 'content-chip-kind', kind: props.kind }}
    />
  );
}

/**
 * How hard the usual words say a puzzle is, as a tint that climbs with it:
 * easy green, medium amber, hard red; any other word an author chose, the
 * plain info blue. The word itself is always the label, so the tint is
 * never the only cue.
 */
const DIFFICULTY_TINT: Readonly<
  Record<string, 'success' | 'warning' | 'destructive'>
> = {
  easy: 'success',
  beginner: 'success',
  medium: 'warning',
  normal: 'warning',
  intermediate: 'warning',
  hard: 'destructive',
  expert: 'destructive',
};

export function difficultyTint(
  difficulty: string
): 'success' | 'warning' | 'destructive' | 'info' {
  return DIFFICULTY_TINT[difficulty.trim().toLowerCase()] ?? 'info';
}

export function ContentDifficultyChip(props: {
  difficulty: string;
}): JSX.Element {
  return (
    <Badge
      intent={difficultyTint(props.difficulty)}
      label={props.difficulty}
      dataSet={{ testid: 'content-chip-difficulty' }}
    />
  );
}

const STATUS_LOOK = {
  draft: { intent: 'warning', dot: 'warning' },
  published: { intent: 'success', dot: 'online' },
  withdrawn: { intent: 'neutral', dot: 'offline' },
  'in-progress': { intent: 'neutral', dot: 'pending' },
  completed: { intent: 'success', dot: 'online' },
  playtest: { intent: 'warning', dot: 'warning' },
} as const satisfies Readonly<
  Record<
    ContentStatus,
    {
      intent: 'warning' | 'success' | 'neutral';
      dot: 'warning' | 'online' | 'offline' | 'pending';
    }
  >
>;

export function ContentStatusChip(props: {
  status: ContentStatus;
}): JSX.Element {
  const { t } = useLingui();
  const label = (): string =>
    ({
      draft: t`Draft`,
      published: t`Published`,
      withdrawn: t`Withdrawn`,
      'in-progress': t`In progress`,
      completed: t`Completed`,
      playtest: t`Playtest`,
    })[props.status];
  return (
    <Badge
      intent={STATUS_LOOK[props.status].intent}
      dot={STATUS_LOOK[props.status].dot}
      label={label()}
      dataSet={{ testid: 'content-chip-status', status: props.status }}
    />
  );
}

/** A row's chips, on one wrapping line under its title. */
export function ContentChips(props: { children: JSX.Element }): JSX.Element {
  return (
    <StackHorizontal gap="xs" wrap align="center">
      {props.children}
    </StackHorizontal>
  );
}

/** A row's description, then its chips on a line of their own. */
export function ContentRowCaption(props: {
  description?: string | undefined;
  children: JSX.Element;
}): JSX.Element {
  return (
    <StackVertical gap="xs">
      <Show when={props.description}>
        {(description) => (
          <P variant="caption" tone="secondary" lines={2}>
            {description()}
          </P>
        )}
      </Show>
      <ContentChips>{props.children}</ContentChips>
    </StackVertical>
  );
}
