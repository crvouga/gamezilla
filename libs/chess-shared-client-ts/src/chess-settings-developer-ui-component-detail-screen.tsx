import {
  CHESS_SCREEN,
  ChessScreensAttr,
  SetChessSelectedUiComponent,
} from '@libs/chess-root-shared-ts/chess-screens';
import { DefineBackButton } from '@libs/spaces-client-ts/spaces-nav-context';
import { useGameScreen } from '@libs/spaces-client-ts/use-game-screen';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces-client-ts/use-space-room-selector';
import { Trans } from '@lingui/solid/macro';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { ExplorerDetail } from '@pkgs/ui-root-client-ts/explorer-detail';
import { type JSX, Show } from 'solid-js';
import { CHESS_COMPONENT_ENTRIES } from './chess-board-register-example';

export function ChessSettingsDeveloperUiComponentDetailScreen(): JSX.Element {
  const dispatch = useSpaceRoomDispatch();
  const gameScreen = useGameScreen();
  const selectedName = useSpaceRoomSelector(
    ChessScreensAttr.selectedUiComponentName.from
  );

  const back = (): void => {
    dispatch(SetChessSelectedUiComponent({ name: null }));
    gameScreen.show(CHESS_SCREEN.settingsDeveloperUi);
  };

  const onNavigate = (id: string): void => {
    dispatch(SetChessSelectedUiComponent({ name: id }));
  };

  return (
    <>
      <DefineBackButton onPress={back} />
      <Show
        when={selectedName()}
        fallback={
          <EmptyState
            title={<Trans>No component selected</Trans>}
            body={<Trans>Pick one from the previous screen.</Trans>}
          />
        }
      >
        {(name) => (
          <ExplorerDetail
            embedded
            componentId={name()}
            entries={CHESS_COMPONENT_ENTRIES}
            onNavigate={onNavigate}
          />
        )}
      </Show>
    </>
  );
}
