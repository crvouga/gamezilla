import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useSpaceRoomSessionId } from '@libs/spaces-client-ts/space-room-context';
import { useSpaceCan } from '@libs/spaces-client-ts/use-space-can';
import { Trans } from '@lingui/solid/macro';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Match, Switch } from 'solid-js';
import { useUnfinishedGame } from './use-unfinished-game';

/** The test id of what the game's choices say finding an opponent offers. */
export const FIND_OPPONENT_OFFER = 'game-choice-multiplayer-offer';

/**
 * What finding an opponent offers, said under its choice in the game's
 * choices (`data-offer`): seeking for the host who may seek, finishing the
 * unfinished game first (returning to it is offered in place of seeking),
 * or watching the host's search and game for anyone else in the space.
 */
export function FindOpponentOffer(props: {
  /** What seeking is for, as the game says it. */
  readonly children: JSX.Element;
}): JSX.Element {
  const game = useUnfinishedGame();
  const spaceId = useSpaceRoomSessionId();
  const hosts = useSpaceCan(() => spaceId() ?? '', PERMISSION.spacesSelectGame);
  const offer = (): string => {
    if (game() !== null) return 'return';
    return hosts() ? 'seek' : 'watch';
  };
  return (
    <Text
      variant="inherit"
      testId={FIND_OPPONENT_OFFER}
      dataSet={{ offer: offer() }}
    >
      <Switch fallback={props.children}>
        <Match when={game()?.kind === 'custom'}>
          <Trans>Finish your custom game first</Trans>
        </Match>
        <Match when={game()?.kind === 'matched'}>
          <Trans>Finish your matched game first</Trans>
        </Match>
      </Switch>
    </Text>
  );
}
