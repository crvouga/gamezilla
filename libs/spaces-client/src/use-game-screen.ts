import {
  GAME_CHOICES_SCREEN,
  GamesRoomAttr,
  ShowGameScreen,
} from '@libs/spaces-shared/games';
import type { Accessor } from 'solid-js';
import {
  useSpaceRoomDispatch,
  useSpaceRoomSelector,
} from './use-space-room-selector';

export type GameScreen = {
  /** The selected game's screen everyone in the space is shown. */
  readonly screen: Accessor<string>;
  /** Show one of the selected game's screens to everyone in the space. */
  readonly show: (screen: string) => void;
  /** Return everyone to the game's choices. */
  readonly showChoices: () => void;
};

/** The space-wide screen of the selected game; every game navigates through it. */
export function useGameScreen(): GameScreen {
  const screen = useSpaceRoomSelector(GamesRoomAttr.screen.from);
  const dispatch = useSpaceRoomDispatch();
  const show = (next: string): void => {
    dispatch(ShowGameScreen({ screen: next }));
  };
  return {
    screen,
    show,
    showChoices: () => show(GAME_CHOICES_SCREEN),
  };
}
