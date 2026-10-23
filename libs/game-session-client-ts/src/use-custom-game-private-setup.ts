import {
  CustomGameSetupsAttr,
  ownCustomGameSetup,
} from '@libs/game-session-shared-ts/custom-game-setup';
import type { CustomGame } from '@libs/game-session-shared-ts/custom-game-state';
import { useSpaceRoomSelector } from '@libs/spaces-client-ts/use-space-room-selector';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import { useRandom } from '@pkgs/uuid-client-ts/solid';
import { type Accessor, createMemo, createSignal } from 'solid-js';

/**
 * The person's own private setup in the space's custom game, for a game
 * whose sides prepare one: the setup this device holds (theirs alone), the
 * arrangement they are making before they are ready, and whether it is one
 * complete setup. Nothing here ever holds another side's setup.
 */
export function useCustomGamePrivateSetup(
  current: Accessor<CustomGame | null>,
  myId: Accessor<string>
) {
  const rules = useTurnGames();
  const random = useRandom();
  const setups = useSpaceRoomSelector(CustomGameSetupsAttr.from);
  const setupRules = createMemo(() => {
    const game = current();
    return game === null ? undefined : rules.forPosition(game.fen).setup;
  });
  const own = createMemo((): string | null => {
    const game = current();
    return game === null
      ? null
      : ownCustomGameSetup(CustomGameSetupsAttr(setups()), game, myId());
  });
  const [arranged, setArranged] = createSignal<{
    readonly gameId: string;
    readonly setup: string;
  } | null>(null);
  const draft = createMemo((): string => {
    const choice = arranged();
    return choice !== null && choice.gameId === current()?.id
      ? choice.setup
      : (own() ?? '');
  });
  return {
    /** Whether the custom game's sides prepare private setups. */
    has: (): boolean => setupRules() !== undefined,
    own,
    draft,
    arrange: (setup: string): void => {
      const id = current()?.id;
      if (id !== undefined) setArranged({ gameId: id, setup });
    },
    complete: (): boolean => setupRules()?.accept(draft()) != null,
    random: (): void => {
      const drawn = setupRules()?.random(random);
      const id = current()?.id;
      if (drawn !== undefined && id !== undefined)
        setArranged({ gameId: id, setup: drawn });
    },
  };
}
