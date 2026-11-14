import { DenialSurface } from '@libs/permissions-client-ts/denial-surface';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { type JSX, Show } from 'solid-js';
import { useContentPackChoiceReady } from './use-content-pack-choice-ready';
import { useContentPlay } from './use-content-play';

export type ContentStartAttemptViewProps = {
  /** An attempt at this puzzle is saved: Play continues it. */
  readonly saved: boolean;
  /** An attempt is being started; its board opens once it is saved. */
  readonly starting: boolean;
  /** Why the last start was refused; the earlier attempt stays saved. */
  readonly failure: string | null;
  /** A new attempt may start: false once the publication is withdrawn. */
  readonly canStart: boolean;
  /** Starting waits (the pack's choice is still arriving). */
  readonly disabled: boolean;
  /** Opens the saved attempt, or starts one and opens it. */
  readonly onPlay: () => void;
  /** Starts another attempt beside the saved one and opens it. */
  readonly onStartFresh: () => void;
  readonly onRetry: () => void;
};

/**
 * Play a published puzzle in one press: "Play" starts and opens it, or
 * "Continue" opens the saved attempt at its position, with starting over
 * beside it as the quieter choice. A refused start says why, with a retry.
 */
export function ContentStartAttemptView(
  props: ContentStartAttemptViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <StackVertical gap="md" maxWidth="form">
      <Show
        when={props.saved}
        fallback={
          <Show when={props.canStart}>
            <Button
              title={t`Play`}
              fullWidth
              loading={props.starting}
              loadingLabel={t`Starting…`}
              disabled={props.disabled}
              onClick={() => props.onPlay()}
              dataSet={{ testid: 'content-start-attempt' }}
            />
          </Show>
        }
      >
        <Button
          title={t`Continue where you left off`}
          fullWidth
          onClick={() => props.onPlay()}
          dataSet={{ testid: 'content-continue-attempt' }}
        />
        <Show when={props.canStart}>
          <Button
            title={t`Start over in a new attempt`}
            intent="neutral"
            variant="outline"
            fullWidth
            loading={props.starting}
            loadingLabel={t`Starting…`}
            disabled={props.disabled}
            onClick={() => props.onStartFresh()}
            dataSet={{ testid: 'content-start-attempt' }}
          />
        </Show>
      </Show>
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
    </StackVertical>
  );
}

/** `ContentStartAttemptView` wired to the person's attempts and permissions. */
export function ContentStartAttempt(props: {
  revisionId: string;
  packRevisionId: string | null;
  disabled: boolean;
}): JSX.Element {
  const decision = useDecision(PERMISSION.puzzlesPlay);
  const choiceReady = useContentPackChoiceReady(
    () => props.revisionId,
    () => props.packRevisionId
  );
  const play = useContentPlay();
  const request = (fresh: boolean) => ({
    revisionId: props.revisionId,
    packRevisionId: props.packRevisionId,
    fresh,
  });
  return (
    <Show
      when={decision().allowed}
      fallback={<DenialSurface decision={decision()} />}
    >
      <ContentStartAttemptView
        saved={play.saved(props.revisionId) !== undefined}
        starting={play.starting() === props.revisionId}
        failure={play.failure()?.message ?? null}
        canStart={!props.disabled}
        disabled={!choiceReady()}
        onPlay={() => play.play(request(false))}
        onStartFresh={() => play.play(request(true))}
        onRetry={play.retry}
      />
    </Show>
  );
}
