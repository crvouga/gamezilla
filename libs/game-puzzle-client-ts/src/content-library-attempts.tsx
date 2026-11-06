import { Trans, useLingui } from '@lingui/solid/macro';
import { PreviewCardGrid } from '@pkgs/ui-root-client-ts/preview-card-grid';
import { For, type JSX, Match, Show, Switch } from 'solid-js';
import { ContentChips, ContentDifficultyChip } from './content-chips';
import {
  ContentLibraryCard,
  type ContentLibraryProgress,
  ContentProgressLine,
} from './content-library-card';

/** A saved attempt or playtest, as the library lists it. */
type ListedAttempt = {
  readonly id: string;
  /** Empty when the source has not reached this device. */
  readonly title: string;
  /** The puzzle definition its thumbnail draws. */
  readonly preview?: string | undefined;
  /** The difficulty its author gave the puzzle; empty when none. */
  readonly difficulty?: string | undefined;
  /** The pack it was started in, and how much of that pack is solved. */
  readonly pack?:
    | (ContentLibraryProgress & { readonly title: string })
    | undefined;
};

/**
 * Which of the person's attempts a list holds; its section's title says
 * where they stand, so its rows carry no status of their own.
 */
export type ContentAttemptList = 'unfinished' | 'finished' | 'playtest';

function ListTitle(props: { list: ContentAttemptList }): JSX.Element {
  return (
    <Switch>
      <Match when={props.list === 'unfinished'}>
        <Trans>Continue playing</Trans>
      </Match>
      <Match when={props.list === 'finished'}>
        <Trans>Solved</Trans>
      </Match>
      <Match when={props.list === 'playtest'}>
        <Trans>Playtests of your drafts</Trans>
      </Match>
    </Switch>
  );
}

function ListFooter(props: { list: ContentAttemptList }): JSX.Element {
  return (
    <Switch>
      <Match when={props.list === 'unfinished'}>
        <Trans>
          Each puzzle keeps your place, even if its author changes it later.
        </Trans>
      </Match>
      <Match when={props.list === 'playtest'}>
        <Trans>Practice runs don't count toward your progress.</Trans>
      </Match>
    </Switch>
  );
}

/** The puzzle's difficulty as a chip, when its author gave one. */
function difficultyOf(difficulty: string | undefined): JSX.Element | undefined {
  return difficulty ? (
    <ContentChips>
      <ContentDifficultyChip difficulty={difficulty} />
    </ContentChips>
  ) : undefined;
}

/**
 * The pack it was started in and how much of it is solved, when any; a
 * solved puzzle's line says so first, so the pack's count never reads as
 * the puzzle's own.
 */
function packOf(
  pack: ListedAttempt['pack'],
  solved: boolean
): JSX.Element | undefined {
  return pack === undefined ? undefined : (
    <ContentProgressLine progress={pack} pack={pack.title} solved={solved} />
  );
}

/**
 * One list of the person's attempts, each row opening where they left it,
 * as compact rows at every width: what to continue, what is solved, or the
 * playtests of their drafts.
 */
export function ContentAttemptSection(props: {
  list: ContentAttemptList;
  attempts: readonly ListedAttempt[];
  renderPreview: ((definition: string) => JSX.Element) | undefined;
  onOpenAttempt: (attemptId: string) => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <Show when={props.attempts.length > 0}>
      <PreviewCardGrid
        layout="rows"
        title={<ListTitle list={props.list} />}
        footer={
          props.list === 'finished' ? undefined : (
            <ListFooter list={props.list} />
          )
        }
      >
        <For each={props.attempts.map((attempt) => attempt.id)}>
          {(id) => {
            const attempt = () =>
              props.attempts.find((entry) => entry.id === id);
            return (
              <ContentLibraryCard
                kind="puzzle"
                title={(attempt()?.title ?? '') || t`Saved puzzle`}
                preview={attempt()?.preview}
                renderPreview={props.renderPreview}
                caption={difficultyOf(attempt()?.difficulty)}
                meta={packOf(attempt()?.pack, props.list === 'finished')}
                onOpen={() => props.onOpenAttempt(id)}
                testid={`content-attempt-${id}`}
              />
            );
          }}
        </For>
      </PreviewCardGrid>
    </Show>
  );
}
