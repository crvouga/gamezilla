import {
  DefineBackButton,
  DefineSpaceTitle,
  useGameChoicesName,
} from '@libs/spaces-client-ts/spaces-nav-context';
import { t } from '@lingui/core/macro';
import type { JSX } from '@solidjs/web';
import { GameHistoryHomeScreenView } from './game-history-home-screen-view';

/** History and stats in a space: the hub, back to the game's choices. */
export function GameHistoryHomeScreen(props: {
  onOpen: (screen: string) => void;
  onBack: () => void;
}): JSX.Element {
  const choices = useGameChoicesName();
  return (
    <>
      <DefineBackButton onPress={props.onBack} label={choices()} />
      <DefineSpaceTitle title={t`History and stats`} />
      <GameHistoryHomeScreenView onOpen={props.onOpen} />
    </>
  );
}
