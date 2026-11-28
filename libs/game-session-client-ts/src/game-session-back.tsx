import type { GameSession } from '@libs/game-session-shared-ts/game-session-state';
import { GameStageBack } from '@libs/spaces-client-ts/game-stage-back';
import { useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import type { JSX } from '@solidjs/web';

export function GameSessionBack(props: {
  readonly game: GameSession | null;
  readonly canResign: boolean;
  readonly backWithinGame: () => boolean;
  readonly leave: () => void;
  readonly resign: () => Promise<void>;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <GameStageBack
      gameId={props.game?.id ?? null}
      action={props.canResign ? 'resign' : null}
      message={
        (props.game?.sides.length ?? 0) > 2
          ? t`The round will end in a draw for all players.`
          : t`Resigning ends this game. Its moves stay in the space's history.`
      }
      backWithinGame={props.backWithinGame}
      returnToSpaceScreen={props.leave}
      submit={props.resign}
    />
  );
}
