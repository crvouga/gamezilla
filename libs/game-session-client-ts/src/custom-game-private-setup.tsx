import { Trans } from '@lingui/solid/macro';
import { useGamePresentation } from '@pkgs/turn-game-client-ts/turn-games-context';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameActions, GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Show } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import type { CustomGameScreenModel } from './use-custom-game-screen';

/**
 * The person's own private setup while the custom game is set up: the
 * game's own setup board, a random setup, and whether it is complete. It
 * locks while they are ready; what they arrange never leaves their device
 * until they become ready, and then only the room and they hold it.
 */
export function CustomGamePrivateSetup(props: {
  model: CustomGameScreenModel;
}): JSX.Element {
  const presentation = useGamePresentation();
  const setup = () => props.model.privateSetup;
  const side = () => props.model.mySide();
  const ready = (): boolean => {
    const mine = side();
    return (
      mine !== null && (props.model.current()?.ready.includes(mine) ?? false)
    );
  };
  return (
    <Show when={setup().has() && side() !== null && props.model.current()}>
      {(game) => (
        <GameSection
          title={<Trans>Your private setup</Trans>}
          description={
            <Trans>Only you see it. Get ready once it is complete.</Trans>
          }
        >
          <Show when={presentation(game().fen).SetupBoard}>
            {(Board) => (
              <Dynamic
                component={Board()}
                setup={setup().draft()}
                side={side() ?? 'white'}
                locked={ready() || !props.model.connected()}
                onChange={(next: string) => setup().arrange(next)}
                testId="custom-game-setup"
              />
            )}
          </Show>
          <P variant="bodyBold" role="status" testId="custom-game-setup-status">
            <Show
              when={setup().complete()}
              fallback={<Trans>Your private setup is incomplete.</Trans>}
            >
              <Trans>Your private setup is complete.</Trans>
            </Show>
          </P>
          <GameActions>
            <GameActionButton
              title={<Trans>Random setup</Trans>}
              dataSet={{ testid: 'custom-game-setup-random' }}
              disabled={ready() || !props.model.connected()}
              operation={async () => setup().random()}
            />
          </GameActions>
        </GameSection>
      )}
    </Show>
  );
}
