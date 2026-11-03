import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';
import { type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { CustomGameScreenModel } from './use-custom-game-screen';

/**
 * The game's own setup board for the person's private setup, the frame's
 * `setupBoard` slot. What they arrange never leaves their device until
 * they become ready, and then only the room and they hold it; it locks
 * while they are ready or offline.
 */
export function CustomGameSetupBoard(props: {
  model: CustomGameScreenModel;
}): JSX.Element {
  const presentation = useGamePresentation();
  const setup = () => props.model.privateSetup;
  const side = () => props.model.mySide();
  const locked = (): boolean => {
    const mine = side();
    const ready =
      mine !== null && (props.model.current()?.ready.includes(mine) ?? false);
    return ready || !props.model.connected();
  };
  return (
    <Show when={props.model.current()}>
      {(game) => (
        <Show when={presentation(game().fen).SetupBoard}>
          {(Board) => (
            <Dynamic
              component={Board()}
              setup={setup().draft()}
              side={side() ?? 'white'}
              locked={locked()}
              onChange={(next: string) => setup().arrange(next)}
              testId="custom-game-setup"
            />
          )}
        </Show>
      )}
    </Show>
  );
}
