import type { ContentKind } from '@libs/game-puzzle-shared-ts/content-types';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { useMutationButton } from '@pkgs/ui-root-client-ts/use-mutation-button';
import { type JSX, Match, Show, Switch } from 'solid-js';
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
   * for a `StepFooter`, where the draft stands is one line of text at the
   * start of the actions' row, and only what blocks publishing is a notice.
   */
  readonly layout?: 'stacked' | 'bar' | undefined;
  /** A step before the check (a puzzle's playtest), first among the actions. */
  readonly before?: JSX.Element;
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

/**
 * Where the draft stands, as the publish footer's text: the playtest proof
 * (puzzles), the last check, then the one next step. A failed check that
 * blocks publishing is a notice above it.
 */
function BarStatus(props: ContentPublicationControlsViewProps): JSX.Element {
  const { t } = useLingui();
  const next = (): string => {
    if (props.kind === 'puzzle' && !props.proven)
      return t`Finish a playtest, then validate.`;
    return props.validation === 'valid'
      ? t`Publish to share it with everyone who plays.`
      : t`Validate, then publish.`;
  };
  return (
    <P
      variant="caption"
      tone="secondary"
      dataSet={{ testid: 'content-publication-status' }}
    >
      <Show when={props.kind === 'puzzle'}>
        <Text
          variant="inherit"
          tone={props.proven ? 'success' : 'default'}
          dataSet={{ testid: 'content-proof', proven: String(props.proven) }}
        >
          {props.proven ? t`Proven by a playtest` : t`Not proven yet`}
        </Text>
        {' · '}
      </Show>
      <Show
        when={props.validation === 'valid'}
        fallback={
          <Text variant="inherit" tone="default">
            {props.validation === 'invalid'
              ? t`Needs changes`
              : t`Not checked yet`}
          </Text>
        }
      >
        <Text
          variant="inherit"
          tone="success"
          dataSet={{ testid: 'content-validation-passed' }}
        >
          {t`Passed its check`}
        </Text>
      </Show>
      {'. '}
      {next()}
    </P>
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
 * The one next step, filled: Validate until the draft passes its check,
 * then Publish. The other stays an outline, so the builder never offers two
 * equally loud choices.
 */
export function publicationNextStep(
  validation: ContentPublicationControlsViewProps['validation']
): 'validate' | 'publish' {
  return validation === 'valid' ? 'publish' : 'validate';
}

/**
 * Validate and publish a draft, presentational: the last check's result,
 * playtest proof, each action's progress and retryable failure, the
 * publication still on its way or refused, and view / withdraw once out.
 */
export function ContentPublicationControlsView(
  props: ContentPublicationControlsViewProps
): JSX.Element {
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
  const next = () => publicationNextStep(props.validation);
  const actions = (): JSX.Element => (
    <StackHorizontal gap="sm" wrap>
      {props.before}
      <Button
        {...validate.buttonProps}
        intent={next() === 'validate' ? 'primary' : 'neutral'}
        variant={next() === 'validate' ? 'solid' : 'outline'}
        dataSet={{ testid: 'content-validate' }}
      />
      <Show
        when={props.publishDenial}
        fallback={
          <Button
            {...publish.buttonProps}
            intent={next() === 'publish' ? 'primary' : 'neutral'}
            variant={next() === 'publish' ? 'solid' : 'outline'}
            dataSet={{ testid: 'content-publish' }}
          />
        }
      >
        {(denial) => <DenialSurfaceView denial={denial()} variant="compact" />}
      </Show>
    </StackHorizontal>
  );
  return (
    <StackVertical gap={props.layout === 'bar' ? 'sm' : 'md'}>
      <PublicationStatus pending={props.pending} refusal={props.refusal} />
      <Switch>
        <Match when={props.layout === 'bar'}>
          <BarFinding {...props} />
          <StackHorizontal gap="sm" wrap align="center" justify="between">
            <BarStatus {...props} />
            {actions()}
          </StackHorizontal>
        </Match>
        <Match when={props.layout !== 'bar'}>
          <ValidationNotices {...props} />
          {actions()}
        </Match>
      </Switch>
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
      <Show when={props.publishDenial === undefined && props.published}>
        <Button
          title={t`View published edition`}
          intent="neutral"
          variant="outline"
          onClick={() => props.onViewPublication()}
          dataSet={{ testid: 'content-view-publication' }}
        />
        <ContentWithdraw
          disabled={props.disabled}
          onWithdraw={props.onWithdraw}
        />
      </Show>
    </StackVertical>
  );
}
