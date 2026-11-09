import type { ContentKind } from '@libs/game-puzzle-shared-ts/content-types';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import {
  type Accessor,
  createMemo,
  type JSX,
  Match,
  Show,
  Switch,
  untrack,
} from 'solid-js';
import type { ContentPublicationCopyState } from './content-publication-copy-state';
import {
  PublicationCopyLead,
  publicationCopyLabel,
} from './content-publication-copy-view';
import {
  type PublicationActionPlace,
  PublicationSteps,
  publicationNextStep,
} from './content-publication-steps';
import { ContentWithdraw } from './content-withdraw';

/**
 * The last publication of this draft still on its way: waiting for the
 * connection, or for the server's confirmation while online.
 */
export type ContentPublicationPending = 'offline' | 'online' | null;

export type ContentPublicationControlsViewProps = {
  readonly kind: ContentKind;
  /** The saved working copy's last check; null before it is saved. */
  readonly validation: 'unchecked' | 'valid' | 'invalid' | null;
  /** What the failed check found; empty asks to complete the details. */
  readonly validationMessage: string;
  /** A completed playtest proves this version can be finished (puzzles). */
  readonly proven: boolean;
  /** A pack's puzzles that are still drafts, by title: published first. */
  readonly waitingOn?: readonly string[] | undefined;
  readonly pending: ContentPublicationPending;
  /** Identity-derived state of the exact current working copy. */
  readonly copyState: ContentPublicationCopyState;
  /** The server's refusal of the last publication, dismissible. */
  readonly refusal?: JSX.Element;
  /** Set when the person may not publish; replaces the Publish button. */
  readonly publishDenial?: DenialView | undefined;
  /** An edition is published, so it can be viewed or withdrawn. */
  readonly published: boolean;
  readonly disabled: boolean;
  readonly onValidate: () => Promise<void>;
  readonly onPublish: () => Promise<void>;
  readonly onViewPublication: () => void;
  readonly onWithdraw: () => Promise<void>;
  /**
   * `stacked` (default): each finding a notice above the actions. `bar`:
   * for a `StepFooter`, one line saying the next step over the steps in
   * order (`PublicationSteps`), and only what blocks publishing a notice.
   */
  readonly layout?: 'stacked' | 'bar' | undefined;
  /**
   * A step before the check (a puzzle's playtest), first among the
   * actions; told whether it is the one next step, to be filled. In the
   * `bar` layout it is drawn where it stands (the lead while it is next,
   * then in its step), each time its place changes; otherwise once.
   */
  readonly before?: ((next: Accessor<boolean>) => JSX.Element) | undefined;
  /** Opens a pack's first draft puzzle, the pack's lead while it waits. */
  readonly onOpenWaiting?: (() => void) | undefined;
  /** `false` while the game cannot play the draft: correct it first. */
  readonly playable?: boolean | undefined;
};

/**
 * The last choice for this draft stays visible across routes and app
 * reopening, after the actions so its removal never moves one.
 */
function PublicationStatus(props: {
  pending: ContentPublicationPending;
  copyState: ContentPublicationCopyState;
  refusal?: JSX.Element;
}): JSX.Element {
  return (
    <>
      <Show when={props.pending !== null}>
        <Notice dataSet={{ testid: 'content-publication-pending' }}>
          <Show when={props.copyState.kind === 'draft'}>
            <Trans>An earlier publication request is still pending.</Trans>{' '}
          </Show>
          <Show
            when={props.pending === 'online'}
            fallback={
              <Trans>
                Publication waits for your connection. Your draft is kept on
                this device.
              </Trans>
            }
          >
            <Trans>
              Publication is waiting for confirmation. Your draft is kept. Keep
              this app connected to share it.
            </Trans>
          </Show>
        </Notice>
      </Show>
      {props.refusal}
    </>
  );
}

function ValidationNotices(
  props: ContentPublicationControlsViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <>
      <Show when={props.validation === 'valid'}>
        <Notice
          tone="success"
          dataSet={{ testid: 'content-validation-passed' }}
        >
          <Trans>
            This draft passed validation. Publication checks it again.
          </Trans>
        </Notice>
      </Show>
      <Show when={props.validation === 'invalid'}>
        <Notice tone="error">
          {props.validationMessage ||
            t`Complete the required details and validate again.`}
        </Notice>
      </Show>
      <Show when={props.kind === 'puzzle'}>
        <Notice
          tone={props.proven ? 'success' : 'neutral'}
          dataSet={{ testid: 'content-proof', proven: String(props.proven) }}
        >
          <Show
            when={props.proven}
            fallback={
              <Trans>
                Not proven yet: finish a playtest of this version to show it can
                be solved.
              </Trans>
            }
          >
            <Trans>Proven: a finished playtest shows it can be solved.</Trans>
          </Show>
        </Notice>
      </Show>
    </>
  );
}

/** A failed check, the one finding that blocks publishing, as a notice. */
function BarFinding(props: ContentPublicationControlsViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <Show when={props.validation === 'invalid'}>
      <Notice tone="error">
        {props.validationMessage ||
          t`Complete the required details and validate again.`}
      </Notice>
    </Show>
  );
}

/**
 * The draft's actions: Validate and Publish with their progress, a
 * puzzle's playtest (mounted once, so a started playtest keeps its "Open
 * playtest"), and the one next step, the only one filled.
 */
function usePublicationActions(props: ContentPublicationControlsViewProps) {
  const { t } = useLingui();
  const validate = useMutationButton({
    operation: () => props.onValidate(),
    labels: {
      idle: t`Validate`,
      loading: t`Checking…`,
      success: t`Check finished`,
      error: t`Check again`,
    },
    get disabled() {
      return props.disabled;
    },
  });
  const publish = useMutationButton({
    operation: () => props.onPublish(),
    labels: {
      get idle() {
        return props.copyState.kind === 'pending' ||
          props.copyState.kind === 'edition'
          ? t`Send again`
          : t`Publish`;
      },
      loading: t`Publishing…`,
      success: t`Publication saved`,
      error: t`Try publishing again`,
    },
    get disabled() {
      return props.disabled || props.copyState.kind === 'reading';
    },
  });
  const next = () =>
    props.copyState.kind === 'pending' || props.copyState.kind === 'edition'
      ? ('publish' as const)
      : publicationNextStep({
          validation: props.validation,
          needsProof: props.kind === 'puzzle' && !props.proven,
          waiting: props.kind === 'pack' && (props.waitingOn?.length ?? 0) > 0,
        });
  const playtestNext = createMemo(() => next() === 'playtest');
  // The stacked layout draws the playtest once; the bar draws it per place.
  const before =
    props.layout === 'bar'
      ? undefined
      : untrack(() => props.before?.(playtestNext));
  // One weight for every step but the next one, which is filled.
  const weight = (step: 'validate' | 'publish') =>
    next() === step
      ? ({ intent: 'primary', variant: 'solid' } as const)
      : ({ intent: 'neutral', variant: 'outline' } as const);
  return { validate, publish, next, before, weight };
}

type PublicationActions = ReturnType<typeof usePublicationActions>;

/** A step's action as drawn where it stands in the `bar` layout. */
function placed(place: PublicationActionPlace) {
  if (place === 'lead') return { intent: 'primary', variant: 'solid' } as const;
  if (place === 'done')
    return { intent: 'neutral', variant: 'outline', size: 'sm' } as const;
  return {
    intent: 'neutral',
    variant: 'ghost',
    size: 'sm',
    locked: true,
  } as const;
}

function PublishButton(props: {
  controls: ContentPublicationControlsViewProps;
  actions: PublicationActions;
  place?: PublicationActionPlace | undefined;
}): JSX.Element {
  const weight = () =>
    props.place === undefined
      ? props.actions.weight('publish')
      : placed(props.place);
  return (
    <Show
      when={props.controls.publishDenial}
      fallback={
        <Button
          {...props.actions.publish.buttonProps}
          {...weight()}
          dataSet={{ testid: 'content-publish' }}
        />
      }
    >
      {(denial) => <DenialSurfaceView denial={denial()} variant="compact" />}
    </Show>
  );
}

/** A failed check or publication, retryable; then view / withdraw once out. */
function PublicationAftermath(props: {
  controls: ContentPublicationControlsViewProps;
  actions: PublicationActions;
}): JSX.Element {
  const { t } = useLingui();
  const { validate, publish } = props.actions;
  return (
    <>
      <Show when={validate.error() ?? publish.error()}>
        {(error) => (
          <ErrorState
            variant="compact"
            title={t`The draft needs your attention`}
            body={error().message}
            retry={{
              onClick: () => {
                void (publish.error() ? publish.run() : validate.run());
              },
            }}
          />
        )}
      </Show>
      <Show
        when={
          props.controls.publishDenial === undefined && props.controls.published
        }
      >
        <Show
          when={
            !(
              props.controls.copyState.kind === 'edition' &&
              props.controls.copyState.current
            )
          }
        >
          <Button
            title={
              props.controls.pending !== null ||
              props.controls.copyState.kind === 'reading'
                ? t`View saved edition`
                : t`View published edition`
            }
            intent="neutral"
            variant="outline"
            onClick={() => props.controls.onViewPublication()}
            dataSet={{ testid: 'content-view-publication' }}
          />
        </Show>
        <ContentWithdraw
          disabled={props.controls.disabled}
          onWithdraw={props.controls.onWithdraw}
        />
      </Show>
    </>
  );
}

/**
 * Validate and publish a draft, presentational: the last check's result,
 * playtest proof, each action's progress and retryable failure, the
 * publication still on its way or refused, and view / withdraw once out.
 */
function publicationProgress(
  props: ContentPublicationControlsViewProps,
  actions: PublicationActions
) {
  const { t } = useLingui();
  return props.copyState.kind === 'draft' ||
    (props.copyState.kind === 'reading' && actions.next() !== 'publish')
    ? undefined
    : {
        label: publicationCopyLabel(props.copyState),
        complete: props.copyState.kind === 'edition',
        currentLabel:
          props.copyState.kind === 'reading' ? t`Checking` : t`Pending`,
        statusInLead:
          props.publishDenial === undefined &&
          !(props.copyState.kind === 'edition' && props.copyState.current),
        lead: (
          <PublicationCopyLead
            state={props.copyState}
            denial={props.publishDenial}
            onView={props.onViewPublication}
          />
        ),
        action:
          props.publishDenial !== undefined ? undefined : (
            <PublishButton controls={props} actions={actions} place="done" />
          ),
      };
}

export function ContentPublicationControlsView(
  props: ContentPublicationControlsViewProps
): JSX.Element {
  const actions = usePublicationActions(props);
  return (
    <StackVertical gap={props.layout === 'bar' ? 'sm' : 'md'}>
      <Switch>
        <Match when={props.layout === 'bar'}>
          <BarFinding {...props} />
          <PublicationSteps
            kind={props.kind}
            validation={props.validation}
            proven={props.proven}
            waitingOn={props.waitingOn ?? []}
            next={actions.next()}
            progress={publicationProgress(props, actions)}
            playtest={(lead) => props.before?.(() => lead)}
            validate={(place) => (
              <Button
                {...actions.validate.buttonProps}
                {...placed(place)}
                dataSet={{ testid: 'content-validate' }}
              />
            )}
            publish={(place) => (
              <PublishButton controls={props} actions={actions} place={place} />
            )}
            onOpenWaiting={props.onOpenWaiting}
            playable={props.playable}
          />
        </Match>
        <Match when={props.layout !== 'bar'}>
          <ValidationNotices {...props} />
          <StackHorizontal gap="sm" wrap>
            {actions.before}
            <Button
              {...actions.validate.buttonProps}
              {...actions.weight('validate')}
              dataSet={{ testid: 'content-validate' }}
            />
            <Show when={props.copyState.kind !== 'draft'}>
              <PublicationCopyLead
                state={props.copyState}
                denial={props.publishDenial}
                onView={props.onViewPublication}
              />
            </Show>
            <Show
              when={
                props.copyState.kind === 'draft' ||
                props.publishDenial === undefined
              }
            >
              <PublishButton
                controls={props}
                actions={actions}
                place={props.copyState.kind === 'draft' ? undefined : 'done'}
              />
            </Show>
          </StackHorizontal>
        </Match>
      </Switch>
      <PublicationAftermath controls={props} actions={actions} />
      {/* Last, so confirmation removing it moves no action under a finger. */}
      <PublicationStatus
        pending={props.pending}
        refusal={props.refusal}
        copyState={props.copyState}
      />
    </StackVertical>
  );
}
