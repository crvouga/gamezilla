import {
  CHESS_SCREEN,
  ChessMainMenuScreenAttr,
  SetChessMainMenuScreen,
  SetChessSelectedUiComponent,
} from '@libs/chess-root-shared/chess-main-menu';
import { DefineBackButton } from '@libs/spaces-client/spaces-nav-context';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from '@libs/spaces-client/use-space-room-selector';
import { Trans } from '@lingui/solid/macro';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { ExplorerDetail } from '@pkgs/ui-root-client/explorer-detail';
import type { JSX } from 'solid-js';
import { CHESS_COMPONENT_ENTRIES } from './chess-board-register-example';

export function ChessSettingsDeveloperUiComponentDetailScreen(): JSX.Element {
  const dispatch = useSpaceRoomDispatch();
  const selectedName = useSpaceRoomSelector(
    ChessMainMenuScreenAttr.selectedUiComponentName.from
  );

  const back = (): void => {
    dispatch(SetChessSelectedUiComponent({ name: null }));
    dispatch(
      SetChessMainMenuScreen({ screen: CHESS_SCREEN.settingsDeveloperUi })
    );
  };

  const onNavigate = (id: string): void => {
    dispatch(SetChessSelectedUiComponent({ name: id }));
  };

  return (
    <div class="box self-stretch flex-1 min-h-0">
      <DefineBackButton onPress={back} />
      {selectedName() === null ? (
        <EmptyState
          title={<Trans>No component selected</Trans>}
          body={<Trans>Pick one from the previous screen.</Trans>}
        />
      ) : (
        <ExplorerDetail
          componentId={selectedName()!}
          entries={CHESS_COMPONENT_ENTRIES}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
}
