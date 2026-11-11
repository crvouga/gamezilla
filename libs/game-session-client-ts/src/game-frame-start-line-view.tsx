import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
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
 * they are not; taking it back is a quiet one once they are.
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
          variant={readiness().ready ? 'ghost' : 'solid'}
          size={readiness().ready ? undefined : 'lg'}
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

function StartButton(props: StartProps): JSX.Element {
  return (
    <Show when={props.start.canStart}>
      <GameActionButton
        title={<Trans>Start game</Trans>}
        dataSet={{ testid: 'custom-game-start' }}
        variant={mustGetReady(props.start) ? 'outline' : 'solid'}
        size={mustGetReady(props.start) ? undefined : 'lg'}
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
 * Starting the game, in the lobby's dock: why it cannot start yet (or
 * "Ready to start."), then the one thing to do next as the dock's filled
 * command, first. Arranging an incomplete private setup comes first, then
 * getting ready; once the viewer is ready Start leads, held back until the
 * game can start, and taking readiness back is the quiet command under it.
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
            {frameStartLine(props.start.reason)}
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
      <Show
        when={mustGetReady(props.start)}
        fallback={
          <>
            <StartButton {...props} />
            <ReadinessCommand {...props} />
          </>
        }
      >
        <ReadinessCommand {...props} />
        <StartButton {...props} />
      </Show>
    </GameLobbyDock>
  );
}
