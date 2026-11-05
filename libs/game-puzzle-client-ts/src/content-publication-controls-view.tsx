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
import {
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
   * actions; told whether it is the one next step, to be filled. Called
   * once: the step stays mounted, with its own state, as the draft's
   * check changes.
   */
  readonly before?: ((next: Accessor<boolean>) => JSX.Element) | undefined;
};

/** The last choice for this draft stays visible across routes and app reopening. */
function PublicationStatus(props: {
  pending: ContentPublicationPending;
  refusal?: JSX.Element;
}): JSX.Element {
  return (
    <>
      <Show when={props.pending !== null}>
        <Notice dataSet={{ testid: 'content-publication-pending' }}>
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
      idle: t`Publish`,
      loading: t`Publishing…`,
      success: t`Publication saved`,
      error: t`Try publishing again`,
    },
    get disabled() {
      return props.disabled;
    },
  });
  const next = () =>
    publicationNextStep({
      validation: props.validation,
      needsProof: props.kind === 'puzzle' && !props.proven,
      waiting: props.kind === 'pack' && (props.waitingOn?.length ?? 0) > 0,
    });
  const playtestNext = createMemo(() => next() === 'playtest');
  const before = untrack(() => props.before?.(playtestNext));
  // One weight for every step but the next one, which is filled.
  const weight = (step: 'validate' | 'publish') =>
    next() === step
      ? ({ intent: 'primary', variant: 'solid' } as const)
      : ({ intent: 'neutral', variant: 'outline' } as const);
  return { validate, publish, next, before, weight };
}

type PublicationActions = ReturnType<typeof usePublicationActions>;

function PublishButton(props: {
  controls: ContentPublicationControlsViewProps;
  actions: PublicationActions;
}): JSX.Element {
  return (
    <Show
      when={props.controls.publishDenial}
      fallback={
        <Button
          {...props.actions.publish.buttonProps}
          {...props.actions.weight('publish')}
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
        <Button
          title={t`View published edition`}
          intent="neutral"
          variant="outline"
          onClick={() => props.controls.onViewPublication()}
          dataSet={{ testid: 'content-view-publication' }}
        />
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
export function ContentPublicationControlsView(
  props: ContentPublicationControlsViewProps
): JSX.Element {
  const actions = usePublicationActions(props);
  const validateButton = (
    <Button
      {...actions.validate.buttonProps}
      {...actions.weight('validate')}
      dataSet={{ testid: 'content-validate' }}
    />
  );
  const publishButton = <PublishButton controls={props} actions={actions} />;
  return (
    <StackVertical gap={props.layout === 'bar' ? 'sm' : 'md'}>
      <PublicationStatus pending={props.pending} refusal={props.refusal} />
      <Switch>
        <Match when={props.layout === 'bar'}>
          <BarFinding {...props} />
          <PublicationSteps
            kind={props.kind}
            validation={props.validation}
            proven={props.proven}
            waitingOn={props.waitingOn ?? []}
            next={actions.next()}
            playtest={actions.before}
            validate={validateButton}
            publish={publishButton}
          />
        </Match>
        <Match when={props.layout !== 'bar'}>
          <ValidationNotices {...props} />
          <StackHorizontal gap="sm" wrap>
            {actions.before}
            {validateButton}
            {publishButton}
          </StackHorizontal>
        </Match>
      </Switch>
      <PublicationAftermath controls={props} actions={actions} />
    </StackVertical>
  );
}
