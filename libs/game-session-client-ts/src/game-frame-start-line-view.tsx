import type { CustomGameInput } from '@libs/game-session-shared-ts/custom-game-choice';
import { Trans } from '@lingui/solid/macro';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameActions } from '@pkgs/ui-root-client-ts/game-section';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import { frameStartLine } from './game-frame-setup-copy';
import type { FrameStart } from './game-frame-view-types';

type Choose = (input: CustomGameInput) => Promise<void>;

type StartProps = {
  readonly start: FrameStart;
  readonly onChoose: Choose;
  readonly onReady: () => Promise<void>;
};

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
          variant={readiness().ready ? 'outline' : 'solid'}
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
 * Starting the game, at the foot of the lobby: why it cannot start yet (or
 * "Ready to start."), then the one thing to do next as the filled command.
 * Getting ready comes first; Start is filled once the viewer is ready, and
 * held back until the game can start. Someone who may not start it is told
 * the host will.
 */
export function FrameStartView(props: StartProps): JSX.Element {
  return (
    <StackVertical gap="md">
      <StackVertical gap="xs">
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
      </StackVertical>
      <GameActions sizing="share">
        <FrameReadinessButton {...props} />
        <Show when={props.start.canStart}>
          <GameActionButton
            title={<Trans>Start game</Trans>}
            dataSet={{ testid: 'custom-game-start' }}
            variant={mustGetReady(props.start) ? 'outline' : 'solid'}
            operation={() => props.onChoose({ operation: 'start' })}
            disabled={props.start.reason !== null}
          />
        </Show>
      </GameActions>
    </StackVertical>
  );
}
