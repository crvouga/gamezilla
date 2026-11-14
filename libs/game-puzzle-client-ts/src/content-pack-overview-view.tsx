import { Trans, useLingui } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { CircleCheckIcon } from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { ProgressBar } from '@pkgs/ui-root-client-ts/progress-bar';
import { Spinner } from '@pkgs/ui-root-client-ts/spinner';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { SuccessState } from '@pkgs/ui-root-client-ts/success-state';
import { P } from '@pkgs/ui-root-client-ts/text';
import { For, type JSX, Match, Show, Switch } from 'solid-js';

/** Where the person stands with one of a pack's puzzles. */
export type ContentPackPuzzleStatus = 'unplayed' | 'in-progress' | 'completed';

/** One of a pack's puzzles, in the pack's order. */
export type ContentPackOverviewPuzzle = {
  readonly revisionId: string;
  readonly title: string;
  readonly status: ContentPackPuzzleStatus;
};

export type ContentPackOverviewViewProps = {
  /**
   * `loading` while the pack is on its way, `missing` when it has not
   * reached this device, `ready` with its puzzles.
   */
  readonly status: 'loading' | 'missing' | 'ready';
  readonly puzzles: readonly ContentPackOverviewPuzzle[];
  readonly completed: number;
  readonly total: number;
  /** The puzzle Play opens: the last one played if unfinished, else the first unfinished. */
  readonly next: ContentPackOverviewPuzzle | null;
  /** Every puzzle is solved. */
  readonly complete: boolean;
  /** The puzzle whose attempt is being started, if any. */
  readonly starting: string | null;
  /** Why the last start was refused; saved work stays kept. */
  readonly failure: string | null;
  /** No new attempt may start (the publication is withdrawn). */
  readonly disabled: boolean;
  /** Opens the puzzle's saved attempt on its board, or starts one there. */
  readonly onPlay: (revisionId: string) => void;
  readonly onRetry: () => void;
};

/** "3 of 5 solved" over a bar of how far through the pack the person is. */
function PackProgress(props: ContentPackOverviewViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <StackVertical gap="sm">
      <P role="status" dataSet={{ testid: 'content-pack-progress' }}>
        {t`${props.completed} of ${props.total} puzzles completed`}
      </P>
      <ProgressBar
        size="sm"
        tone={props.complete ? 'success' : 'tint'}
        progress={props.completed / Math.max(1, props.total)}
        accessibleLabel={t`${props.completed} of ${props.total} puzzles completed`}
      />
    </StackVertical>
  );
}

/** The one filled command: play the puzzle that is up next. */
function PlayNext(props: ContentPackOverviewViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <Show when={props.next}>
      {(next) => (
        <Button
          title={
            next().status === 'unplayed'
              ? t`Play ${next().title}`
              : t`Continue ${next().title}`
          }
          fullWidth
          loading={props.starting === next().revisionId}
          loadingLabel={t`Starting…`}
          disabled={props.disabled && next().status === 'unplayed'}
          onClick={() => props.onPlay(next().revisionId)}
          dataSet={{ testid: 'content-pack-next' }}
        />
      )}
    </Show>
  );
}

/** A puzzle's place in the pack, as a word: solved, in progress, up next, or not started. */
function PuzzleState(props: {
  puzzle: ContentPackOverviewPuzzle;
  next: boolean;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <Switch>
      <Match when={props.puzzle.status === 'completed'}>
        <Badge intent="success" label={t`Solved`} />
      </Match>
      <Match when={props.next}>
        <Badge intent="brand" label={t`Up next`} />
      </Match>
      <Match when={props.puzzle.status === 'in-progress'}>
        <Badge intent="info" label={t`In progress`} />
      </Match>
      <Match when={true}>
        <Badge intent="neutral" label={t`Not started`} />
      </Match>
    </Switch>
  );
}

/** Every puzzle in the pack's order, each opening straight onto its board. */
function PuzzleList(props: ContentPackOverviewViewProps): JSX.Element {
  const { t } = useLingui();
  const puzzle = (id: string) =>
    props.puzzles.find((entry) => entry.revisionId === id);
  return (
    <MenuSection
      title={<Trans>Puzzles in this pack</Trans>}
      footer={<Trans>Play them in any order. Each keeps your place.</Trans>}
      dataSet={{ testid: 'content-pack-puzzles' }}
    >
      <For each={props.puzzles.map((entry) => entry.revisionId)}>
        {(id, index) => (
          <MenuRow
            title={t`${index() + 1}. ${puzzle(id)?.title ?? ''}`}
            value={
              <Show
                when={props.starting === id}
                fallback={
                  <PuzzleState
                    puzzle={
                      puzzle(id) ?? {
                        revisionId: id,
                        title: '',
                        status: 'unplayed',
                      }
                    }
                    next={props.next?.revisionId === id && !props.complete}
                  />
                }
              >
                <Spinner size="sm" label={t`Starting…`} />
              </Show>
            }
            disabled={
              props.starting !== null ||
              (props.disabled && puzzle(id)?.status === 'unplayed')
            }
            onClick={() => props.onPlay(id)}
            dataSet={{ testid: `content-pack-puzzle-${id}` }}
          />
        )}
      </For>
    </MenuSection>
  );
}

/**
 * A published pack's overview, presentational: how far through it the
 * person is, the one filled command to play the puzzle up next (straight
 * onto its board), and every puzzle in order with where the person stands,
 * each also opening onto its board. A complete pack says so first; a pack
 * not fully on this device says what is missing; a refused start says why.
 */
export function ContentPackOverviewView(
  props: ContentPackOverviewViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <Switch>
      <Match when={props.status === 'loading'}>
        <LoadingState />
      </Match>
      <Match when={props.status === 'missing'}>
        <Notice tone="error">
          <Trans>
            This pack is not available on this device. Reconnect and open it
            again.
          </Trans>
        </Notice>
      </Match>
      <Match when={props.status === 'ready'}>
        <StackVertical gap="lg">
          <Show when={props.complete}>
            <SuccessState
              variant="compact"
              icon={CircleCheckIcon}
              title={t`Pack completed`}
              body={t`Every puzzle is solved. Play any of them again below.`}
              dataSet={{ testid: 'content-pack-complete' }}
            />
          </Show>
          <PackProgress {...props} />
          <PlayNext {...props} />
          <Show when={props.failure}>
            {(message) => (
              <ErrorState
                variant="compact"
                title={t`The puzzle did not start`}
                body={message()}
                retry={{ onClick: () => props.onRetry() }}
                dataSet={{ testid: 'content-start-failed' }}
              />
            )}
          </Show>
          <Show when={props.puzzles.length < props.total}>
            <Notice>
              <Trans>
                Some puzzles have not reached this device. Reconnect to load the
                rest. Your progress stays saved.
              </Trans>
            </Notice>
          </Show>
          <PuzzleList {...props} />
        </StackVertical>
      </Match>
    </Switch>
  );
}
