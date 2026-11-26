import {
  GAME_HOME_SCREEN,
  GamesRoomAttr,
  ShowGameScreen,
} from '@libs/spaces-shared-ts/games';
import type { JSX } from '@solidjs/web';
import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  useContext,
} from 'solid-js';
import { useSpaceOpenRooms } from './space-open-rooms-store';
import { useSpaceRoomSessionId } from './space-room-context';
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
function useSharedGameScreen(): GameScreen {
  const screen = useSpaceRoomSelector(GamesRoomAttr.screen.from);
  const dispatch = useSpaceRoomDispatch();
  const show = (next: string): void => {
    dispatch(ShowGameScreen({ screen: next }));
  };
  return {
    screen,
    show,
    showChoices: () => show(GAME_HOME_SCREEN),
  };
}

export type VisitedGameScreen = GameScreen & {
  readonly backFromBoard: (personal: boolean) => void;
};
const ScreenContext = createContext<VisitedGameScreen | null>(null);

/** The room keeps playing while someone steps away from its board on their device. */
export function GameScreenProvider(props: {
  readonly game: string;
  readonly children: JSX.Element;
}): JSX.Element {
  const shared = useSharedGameScreen();
  const space = useSpaceRoomSessionId();
  const history = useSpaceOpenRooms().history;
  const [personal, setPersonal] = createSignal<string | null>(() => {
    shared.screen();
    space();
    props.game;
    return null;
  });
  const screen = createMemo(() => personal() ?? shared.screen());
  createEffect(
    () => [space(), props.game, screen()] as const,
    ([id, game, shown]) => {
      if (id !== null) history.visit(id, game, shown);
    }
  );
  const show = (next: string): void => {
    if (personal() === null) shared.show(next);
    else setPersonal(next === shared.screen() ? null : next);
  };
  const navigation = {
    screen,
    show,
    showChoices: () => show(GAME_HOME_SCREEN),
    backFromBoard: (onlyHere: boolean) => {
      const next = history.back(space() ?? '', props.game, screen());
      if (onlyHere) setPersonal(next);
      else show(next);
    },
  };
  return <ScreenContext value={navigation}>{props.children}</ScreenContext>;
}

export function useGameScreen(): GameScreen {
  return useContext(ScreenContext) ?? useSharedGameScreen();
}

export function useVisitedGameScreen(): VisitedGameScreen {
  const navigation = useContext(ScreenContext);
  if (!navigation) throw new Error('GameScreenProvider missing');
  return navigation;
}
