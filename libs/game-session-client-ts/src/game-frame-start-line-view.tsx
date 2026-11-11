import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameLobbyDock } from '@pkgs/ui-root-client-ts/game-lobby';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import { frameStartLine } from './game-frame-setup-copy';
import type { FrameStart } from './game-frame-view-types';

type Choose = (input: CustomGameInput) => Promise<void>;

type StartProps = {
  readonly start: FrameStart;
  readonly onChoose: Choose;
  readonly onReady: () => Promise<void>;
  /**
   * Opens the person's private setup. While theirs is incomplete, arranging
   * it is the thing to do next, in place of a readiness they cannot give.
   */
  readonly onArrange?: (() => void) | undefined;
};

/** The viewer cannot get ready until their private setup is complete. */
function mustArrange(props: StartProps): boolean {
  const readiness = props.start.readiness;
  return (
    props.onArrange !== undefined &&
    readiness !== null &&
    !readiness.ready &&
    readiness.blocked
  );
}

/** The viewer's own readiness is the next thing to do. */
function mustGetReady(start: FrameStart): boolean {
  return start.readiness !== null && !start.readiness.ready;
}

/**
 * The person's own readiness: getting ready is the filled command while
 * they are not; taking it back is an outlined one of the same size once they are.
 */
export function FrameReadinessButton(props: StartProps): JSX.Element {
  return (
    <Show when={props.start.readiness}>
      {(readiness) => (
        <GameActionButton
          title={
            <Show when={readiness().ready} fallback={<Trans>I'm ready</Trans>}>
              <Trans>I'm not ready</Trans>
            </Show>
          }
          dataSet={{ testid: 'custom-game-ready' }}
          variant={readiness().ready ? 'outline' : 'solid'}
          size="lg"
          disabled={!readiness().ready && readiness().blocked}
          operation={() =>
            readiness().ready
              ? props.onChoose({ operation: 'unready' })
              : props.onReady()
          }
        />
      )}
    </Show>
  );
}

/**
 * Start, once the viewer is ready: held back, with the line over it saying
 * why, until the game can start. Before that their own readiness is the
 * one command, so the dock never shows a start that cannot be pressed
 * beside the thing to press.
 */
function StartButton(props: StartProps): JSX.Element {
  return (
    <Show when={props.start.canStart && !mustGetReady(props.start)}>
      <GameActionButton
        title={<Trans>Start game</Trans>}
        dataSet={{ testid: 'custom-game-start' }}
        variant="solid"
        size="lg"
        operation={() => props.onChoose({ operation: 'start' })}
        disabled={props.start.reason !== null}
      />
    </Show>
  );
}

/** The command the viewer's own readiness asks for: arrange, or get ready. */
function ReadinessCommand(props: StartProps): JSX.Element {
  return (
    <Show
      when={mustArrange(props)}
      fallback={<FrameReadinessButton {...props} />}
    >
      <Button
        title={<Trans>Arrange your setup</Trans>}
        variant="solid"
        size="lg"
        onClick={() => props.onArrange?.()}
        dataSet={{ testid: 'custom-game-setup-arrange' }}
      />
    </Show>
  );
}

/**
 * The line over the dock's command. The last person everyone waits for is
 * told so in the second person, never counted as "1 person".
 */
function startLine(start: FrameStart): string {
  const reason = start.reason;
  const last =
    reason?.kind === 'unready' && reason.count === 1 && mustGetReady(start);
  if (!last) return frameStartLine(reason);
  return start.canStart
    ? t`Everyone else is in. Get ready to start.`
    : t`Everyone else is ready. Get ready to play.`;
}

/**
 * Starting the game, in the lobby's dock: why it cannot start yet (or
 * "Ready to start."), then the one thing to do next as the dock's filled
 * command, first. Arranging an incomplete private setup comes first, then
 * getting ready; once the viewer is ready Start leads, held back until the
 * game can start, and taking readiness back is the quiet command under it.
 * Start is not shown before then: one filled command, nothing inert.
 * Someone who may not start it is told the host will. A member with no
 * seat (`seat`) takes one here.
 */
export function FrameStartView(
  props: StartProps & { readonly seat?: JSX.Element | undefined }
): JSX.Element {
  return (
    <GameLobbyDock
      status={
        <>
          <P variant="bodyBold" role="status" testId="custom-game-startable">
            {startLine(props.start)}
          </P>
          <Show when={props.start.hostStarts}>
            <P
              variant="caption"
              tone="secondary"
              testId="custom-game-host-starts"
            >
              <Trans>Waiting for the host to start.</Trans>
            </P>
          </Show>
        </>
      }
    >
      {props.seat}
      <StartButton {...props} />
      <ReadinessCommand {...props} />
    </GameLobbyDock>
  );
}
