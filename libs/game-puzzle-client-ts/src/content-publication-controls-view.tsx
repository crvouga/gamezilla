import type { ContentKind } from '@libs/game-puzzle-shared-ts/content-types';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { type Accessor, type JSX, Show } from 'solid-js';
import { contentBuilderNextStep } from './content-builder-standing';
import type { ContentPublicationCopyState } from './content-publication-copy-state';
import {
  PublicationCopyLead,
  publicationCopyLabel,
} from './content-publication-copy-view';
import { useRefusalReason } from './content-publication-refusal';
import {
  type PublicationActionPlace,
  PublicationSteps,
} from './content-publication-steps';

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
  /** Set when the person may not publish; replaces the Publish button. */
  readonly publishDenial?: DenialView | undefined;
  /** An edition is published, so it can be viewed or withdrawn. */
  readonly published: boolean;
  readonly disabled: boolean;
  readonly onValidate: () => Promise<void>;
  readonly onPublish: () => Promise<void>;
  readonly onViewPublication: () => void;
  /** Asks to withdraw the publication; the builder's shell confirms first. */
  readonly onWithdraw: () => void;
  /**
   * A step before the check (a puzzle's playtest), first among the
   * actions; told whether it is the one next step, to be filled. It is
   * drawn where it stands (the lead while it is next, then in its step),
   * each time its place changes.
   */
  readonly before?: ((next: Accessor<boolean>) => JSX.Element) | undefined;
  /** Opens a pack's first draft puzzle, the pack's lead while it waits. */
  readonly onOpenWaiting?: (() => void) | undefined;
  /** `false` while the game cannot play the draft: correct it first. */
  readonly playable?: boolean | undefined;
  /** Opens the details or the board, to correct what blocks publishing. */
  readonly onFix?: ((where: 'details' | 'board') => void) | undefined;
  /** The server refused the last publication; its notice says why. */
  readonly refused?: boolean | undefined;
  /** Where the failed check's (or refusal's) finding is corrected. */
  readonly fixTarget?: 'details' | 'board' | undefined;
  /** The refusal's first finding, by its code, said in local words. */
  readonly refusalIssue?: string | null | undefined;
};

/**
 * A publication still on its way stays said across places and app
 * reopening, after the actions so its removal never moves one.
 */
function PublicationPending(props: {
  pending: ContentPublicationPending;
  copyState: ContentPublicationCopyState;
}): JSX.Element {
  return (
    <Show when={props.pending !== null}>
      <Notice dataSet={{ testid: 'content-publication-pending' }}>
        <Show when={props.copyState.kind === 'draft'}>
          <Trans>An earlier publication request is still pending.</Trans>{' '}
        </Show>
        <Show
          when={props.pending === 'online'}
          fallback={
            <Trans>
              Publication waits for your connection. Your draft is kept on this
              device.
            </Trans>
          }
        >
          <Trans>
            Publication is waiting for confirmation. Your draft is kept. Keep
            this app connected to share it.
          </Trans>
        </Show>{' '}
        <Show when={props.copyState.kind === 'pending'}>
          <Trans>
            Retry sending only if it stays waiting: it sends this same copy and
            never makes a second edition.
          </Trans>
        </Show>
      </Notice>
    </Show>
  );
}

/** The ways to the details and the board, where a finding is corrected. */
function FixRoutes(props: {
  onFix: (where: 'details' | 'board') => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <StackHorizontal gap="sm" wrap>
      <Button
        title={t`Edit details`}
        intent="neutral"
        variant="outline"
        size="sm"
        onClick={() => props.onFix('details')}
        dataSet={{ testid: 'content-fix-details' }}
      />
      <Button
        title={t`Edit board`}
        intent="neutral"
        variant="outline"
        size="sm"
        onClick={() => props.onFix('board')}
        dataSet={{ testid: 'content-fix-board' }}
      />
    </StackHorizontal>
  );
}

/**
 * What blocks publishing and the ways to correct it: a failed check as a
 * notice holding the routes to the details and the board; after a refused
 * publication (its notice, above, says why) just those routes.
 */
function Finding(props: ContentPublicationControlsViewProps): JSX.Element {
  const { t } = useLingui();
  const refusalReason = useRefusalReason();
  return (
    <Show
      when={props.validation === 'invalid'}
      fallback={
        <Show when={props.refused === true}>
          <Notice tone="warning" dataSet={{ testid: 'content-refusal-fixes' }}>
            <StackVertical gap="sm">
              {refusalReason(props.refusalIssue ?? null)}
              {/* With a known place to fix it the lead opens it; otherwise both. */}
              <Show when={props.fixTarget === undefined && props.onFix}>
                {(onFix) => <FixRoutes onFix={onFix()} />}
              </Show>
            </StackVertical>
          </Notice>
        </Show>
      }
    >
      <Notice tone="error" dataSet={{ testid: 'content-validation-finding' }}>
        <StackVertical gap="sm">
          {props.validationMessage ||
            t`Complete the required details and validate again.`}
          <Show when={props.fixTarget === undefined && props.onFix}>
            {(onFix) => <FixRoutes onFix={onFix()} />}
          </Show>
        </StackVertical>
      </Notice>
    </Show>
  );
}

/**
 * The draft's actions: Validate and Publish with their progress, and the
 * one next step, the only one filled.
 */
function usePublicationActions(props: ContentPublicationControlsViewProps) {
  const { t } = useLingui();
  const validate = useMutationButton({
    operation: () => props.onValidate(),
    labels: {
      get idle() {
        return props.validation === 'unchecked' || props.validation === null
          ? t`Validate`
          : t`Validate again`;
      },
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
        if (props.copyState.kind === 'pending') return t`Retry sending`;
        return props.copyState.kind === 'edition' || props.refused === true
          ? t`Publish again`
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
    contentBuilderNextStep({
      kind: props.kind,
      validation: props.validation,
      proven: props.proven,
      waitingOn: props.waitingOn ?? [],
      copyState: props.copyState,
    });
  return { validate, publish, next };
}

type PublicationActions = ReturnType<typeof usePublicationActions>;

/** A step's action as drawn where it stands. */
function placed(place: PublicationActionPlace) {
  if (place === 'lead') return { intent: 'primary', variant: 'solid' } as const;
  if (place === 'done')
    return { intent: 'primary', variant: 'ghost', size: 'sm' } as const;
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
  place: PublicationActionPlace;
}): JSX.Element {
  const weight = () => placed(props.place);
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
        <StackVertical gap="sm" testId="content-published-edition">
          <P variant="label" tone="secondary">
            <Trans>Published edition</Trans>
          </P>
          <StackHorizontal gap="sm" wrap align="center">
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
            <Button
              title={t`Withdraw published edition`}
              intent="danger"
              variant="outline"
              onClick={() => props.controls.onWithdraw()}
              disabled={props.controls.disabled}
              dataSet={{ testid: 'content-withdraw' }}
            />
          </StackHorizontal>
        </StackVertical>
      </Show>
    </>
  );
}

/** What became of a copy that was sent, drawn in the Publication step. */
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

/**
 * Checking and publishing a draft, presentational: what the last check
 * found, the one next step's action filled over every step in order
 * (`PublicationSteps`), each action's progress and retryable failure, view
 * and withdraw once out, and a publication still on its way.
 */
export function ContentPublicationControlsView(
  props: ContentPublicationControlsViewProps
): JSX.Element {
  const actions = usePublicationActions(props);
  return (
    <StackVertical gap="sm">
      <Finding {...props} />
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
        refused={props.refused}
        onFix={props.onFix}
        fixTarget={props.fixTarget}
        publishNote={
          props.publishDenial === undefined ? undefined : (
            <DenialSurfaceView denial={props.publishDenial} variant="compact" />
          )
        }
      />
      <PublicationAftermath controls={props} actions={actions} />
      {/* Last, so confirmation removing it moves no action under a finger. */}
      <PublicationPending pending={props.pending} copyState={props.copyState} />
    </StackVertical>
  );
}
