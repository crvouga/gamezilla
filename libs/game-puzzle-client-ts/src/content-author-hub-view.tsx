import type { ContentBody } from '@libs/game-puzzle-shared-ts/content-types';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { type JSX, Match, Switch } from 'solid-js';
import type { ContentAuthorScreenViewProps } from './content-author-screen-view';
import type { ContentBuilderStanding } from './content-builder-standing';
import { publicationCopyLabel } from './content-publication-copy-view';

type View = ContentAuthorScreenViewProps;

/** What the details row says under its name: the difficulty, then the description. */
function detailsSummary(body: ContentBody): string {
  return [body.difficulty.trim(), body.description.trim()]
    .filter((part) => part !== '')
    .join(' · ');
}

/** Where checking and publishing stands, as its row's caption. */
function useStandingValue(): (standing: ContentBuilderStanding) => string {
  const { t } = useLingui();
  return (standing) => {
    if (standing.kind === 'puzzles')
      return standing.waiting.length === 1
        ? t`1 puzzle in the pack is still a draft`
        : t`${standing.waiting.length} puzzles in the pack are still drafts`;
    if (standing.kind === 'fix') return t`Fix the board, then playtest`;
    if (standing.kind === 'playtest') return t`Playtest next, then validate`;
    if (standing.kind === 'validate')
      return standing.invalid
        ? t`Validation found something to fix`
        : t`Validate next, then publish`;
    if (standing.kind === 'publish') return t`Ready to publish`;
    if (standing.kind === 'reading')
      return publicationCopyLabel({ kind: 'reading' });
    return standing.kind === 'pending'
      ? publicationCopyLabel(standing)
      : publicationCopyLabel({ kind: 'edition', current: standing.current });
  };
}

/**
 * The steps before publishing: the details, the board, a look at it. Where
 * a step stands is its caption, which wraps, so it is never cut short.
 */
function DraftRows(props: { view: View }): JSX.Element {
  const { t } = useLingui();
  const pack = () => props.view.kind === 'pack';
  const boardCaption = () => {
    if (pack()) return t`Add, order and remove puzzles`;
    return props.view.playable === false
      ? t`Cannot be played yet. Fix the board.`
      : t`Build the puzzle`;
  };
  return (
    <>
      <MenuRow
        title={t`Details`}
        caption={
          props.view.body.title.trim() === ''
            ? t`No title yet. Add a title, description and difficulty.`
            : detailsSummary(props.view.body) ||
              t`Add a description and difficulty`
        }
        onClick={() => props.view.onOpen({ screen: 'details' })}
        dataSet={{ testid: 'content-author-details-toggle' }}
      />
      <MenuRow
        title={pack() ? t`Puzzles` : t`Board`}
        caption={boardCaption()}
        value={pack() ? String(props.view.puzzles ?? 0) : undefined}
        onClick={() => props.view.onOpen({ screen: 'board' })}
        dataSet={{ testid: 'content-open-board' }}
      />
      <MenuRow
        title={t`Preview`}
        caption={
          props.view.previewable === false
            ? t`Opens once the board can be played`
            : t`The draft as a solver sees it`
        }
        // A change still being kept would preview the copy before it.
        disabled={props.view.disabled || props.view.previewable === false}
        onClick={() => props.view.onOpen({ screen: 'preview', puzzleId: null })}
        dataSet={{ testid: 'content-preview' }}
      />
    </>
  );
}

/**
 * The builder's steps, in order, each a row with where it stands: the
 * details, the board (a pack's puzzles), the preview, checking and
 * publishing, and the kept draft copies.
 */
function StepRows(props: { view: View }): JSX.Element {
  const { t } = useLingui();
  const standing = useStandingValue();
  return (
    <MenuSection
      title={<Trans>Steps</Trans>}
      dataSet={{ testid: 'content-author-steps' }}
    >
      <DraftRows view={props.view} />
      <MenuRow
        title={t`Check and publish`}
        caption={
          props.view.refused === true
            ? t`Publishing was refused. Correct the draft, then publish again.`
            : standing(props.view.standing)
        }
        onClick={() => props.view.onOpen({ screen: 'publish' })}
        dataSet={{ testid: 'content-open-publish' }}
      />
      <MenuRow
        title={t`Draft copies`}
        caption={
          props.view.conflicted
            ? t`Choose the copy to keep working from`
            : t`Every save keeps a copy`
        }
        value={String(props.view.copies ?? 0)}
        onClick={() => props.view.onOpen({ screen: 'copies' })}
        dataSet={{ testid: 'content-open-copies' }}
      />
    </MenuSection>
  );
}

/** The next step's command: filled, and it leads to where the step is taken. */
function NextButton(props: {
  title: string;
  testid: string;
  onPress: () => void;
}): JSX.Element {
  return (
    <Button
      title={props.title}
      intent="primary"
      variant="solid"
      fullWidth
      onClick={() => props.onPress()}
      dataSet={{ testid: props.testid }}
    />
  );
}

/** A next step taken on the publish screen: its name, then that screen. */
function PublishNext(props: { view: View; title: string }): JSX.Element {
  return (
    <NextButton
      title={props.title}
      testid="content-author-next"
      onPress={() => props.view.onOpen({ screen: 'publish' })}
    />
  );
}

/**
 * The one next step, the hub's only filled command: finish a pack's draft
 * puzzle, fix the board, playtest, validate, publish, or view what is
 * published. A copy on its way has nothing to press: its row says where
 * it stands.
 */
function NextStep(props: { view: View }): JSX.Element {
  const { t } = useLingui();
  const standing = () => props.view.standing;
  const waiting = () => {
    const current = standing();
    return current.kind === 'puzzles' ? (current.waiting[0] ?? '') : '';
  };
  const invalid = () => {
    const current = standing();
    return current.kind === 'validate' && current.invalid;
  };
  const published = () => {
    const current = standing();
    return current.kind === 'published' && current.current;
  };
  return (
    <Switch>
      {/* A failed save leads with its own retry, in the notice above. */}
      <Match when={props.view.save.error !== null}>{null}</Match>
      <Match when={props.view.conflicted}>
        <NextButton
          title={t`Next: choose a draft copy`}
          testid="content-author-next"
          onPress={() => props.view.onOpen({ screen: 'copies' })}
        />
      </Match>
      <Match when={standing().kind === 'puzzles'}>
        <NextButton
          title={t`Next: finish ${waiting()}`}
          testid="content-open-waiting"
          onPress={() => props.view.onOpenWaiting?.()}
        />
      </Match>
      <Match when={standing().kind === 'fix'}>
        <NextButton
          title={t`Next: fix the board`}
          testid="content-author-next"
          onPress={() => props.view.onOpen({ screen: 'board' })}
        />
      </Match>
      <Match when={standing().kind === 'playtest'}>
        <PublishNext view={props.view} title={t`Next: playtest`} />
      </Match>
      <Match when={invalid()}>
        <PublishNext view={props.view} title={t`Next: correct the draft`} />
      </Match>
      <Match when={standing().kind === 'validate'}>
        <PublishNext view={props.view} title={t`Next: validate`} />
      </Match>
      <Match when={standing().kind === 'publish' && props.view.refused}>
        <PublishNext view={props.view} title={t`Next: correct and publish`} />
      </Match>
      <Match when={standing().kind === 'publish'}>
        <PublishNext view={props.view} title={t`Next: publish`} />
      </Match>
      <Match when={published()}>
        <NextButton
          title={t`View published edition`}
          testid="content-view-publication"
          onPress={() => props.view.onViewPublication?.()}
        />
      </Match>
    </Switch>
  );
}

/**
 * The builder's hub: one row per step with where it stands, then the one
 * next step as the only filled command.
 */
export function ContentAuthorHubView(props: { view: View }): JSX.Element {
  return (
    <StackVertical gap="lg">
      <StepRows view={props.view} />
      <NextStep view={props.view} />
    </StackVertical>
  );
}
