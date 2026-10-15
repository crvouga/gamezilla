import MultiplayerScreen from '@libs/game-matchmaking-client/multiplayer-screen';
import { CustomGameScreen } from '@libs/game-session-client/custom-game-screen';
import { GameHistory } from '@libs/game-session-client/game-history';
import { DefineBackButton } from '@libs/spaces-client/spaces-nav-context';
import type {
  GameClientDefinition,
  GameClientMenuProps,
} from '@libs/spaces-shared/game';
import { Trans } from '@lingui/solid/macro';
import { useLocalSearchParams } from '@pkgs/ui-root-client/app-router';
import { MainMenuScreen } from '@pkgs/ui-root-client/main-menu-screen';
import { createSignal, type JSX, Match, Switch } from 'solid-js';
import { connectFourPresentation } from './connect-four-presentation';

function ConnectFourMenu(props: GameClientMenuProps): JSX.Element {
  const params = useLocalSearchParams<{ multiplayer?: string }>();
  const [screen, setScreen] = createSignal(
    params().multiplayer === undefined ? 'menu' : 'multiplayer'
  );
  return (
    <Switch
      fallback={
        <>
          <DefineBackButton onPress={props.onBackToGames} />
          <MainMenuScreen
            screenId="connect-four-menu"
            title={<Trans>Connect Four</Trans>}
            subtitle={
              <Trans>Drop a disc. Connect four. Plan your next turn.</Trans>
            }
            items={[
              {
                key: 'custom',
                title: <Trans>Custom games</Trans>,
                caption: (
                  <Trans>Play a person, choose a bot, or watch two bots</Trans>
                ),
                dataSet: { testid: 'connect-four-custom' },
                onClick: () => setScreen('custom'),
              },
              {
                key: 'multiplayer',
                title: <Trans>Find an opponent</Trans>,
                caption: <Trans>Meet another Connect Four player</Trans>,
                dataSet: { testid: 'connect-four-multiplayer' },
                onClick: () => setScreen('multiplayer'),
              },
              {
                key: 'history',
                title: <Trans>History and stats</Trans>,
                caption: <Trans>Review your games, wins and draws</Trans>,
                dataSet: { testid: 'connect-four-history' },
                onClick: () => setScreen('history'),
              },
            ]}
            helper={
              <p class="text textCaption">
                <Trans>
                  Red circles play first, then Yellow diamonds. Choose a column
                  to drop into its lowest empty place. Four in a row, column, or
                  diagonal wins. A full board without four is a draw.
                </Trans>
              </p>
            }
          />
        </>
      }
    >
      <Match when={screen() === 'custom'}>
        <CustomGameScreen
          title="Connect Four"
          onBack={() => setScreen('menu')}
          onHistory={() => setScreen('history')}
        />
      </Match>
      <Match when={screen() === 'history'}>
        <GameHistory gameId="connect-four" onBack={() => setScreen('menu')} />
      </Match>
      <Match when={screen() === 'multiplayer'}>
        <MultiplayerScreen
          title="Connect Four"
          onBack={() => setScreen('menu')}
        />
      </Match>
    </Switch>
  );
}
export const connectFourGameClient: GameClientDefinition = {
  presentation: connectFourPresentation,
  id: 'connect-four',
  title: 'Connect Four',
  caption: 'Connect four discs, play friends or bots',
  MainMenu: ConnectFourMenu,
};
