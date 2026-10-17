import type { CustomGameSide } from '@libs/game-session-shared/custom-game-state';
import { Trans } from '@lingui/solid/macro';
import { useTurnGames } from '@pkgs/turn-game-client/turn-games-context';
import { GameActionButton } from '@pkgs/ui-root-client/game-action-button';
import { GameActions } from '@pkgs/ui-root-client/game-section';
import { For, type JSX, Show } from 'solid-js';
import type { CustomGameScreenModel } from './use-custom-game-screen';
export function CustomGameDifficulty(props: {
  model: CustomGameScreenModel;
  side: CustomGameSide;
}): JSX.Element {
  const rules = useTurnGames();
  const difficulties = () => {
    const game = props.model.current();
    return game === null
      ? []
      : (rules.capability(rules.forPosition(game.fen).id, 'custom-games')?.bots
          .difficulties ?? []);
  };
  return (
    <Show
      when={
        difficulties().length > 0 &&
        props.model.canBot() &&
        props.model.current()?.[props.side].kind === 'bot'
      }
    >
      <p class="text textCaption">
        <Trans>Bot difficulty</Trans>
      </p>
      <GameActions>
        <For each={difficulties()}>
          {(difficulty) => (
            <GameActionButton
              title={
                difficulty === 'easy' ? (
                  <Trans>Easy</Trans>
                ) : difficulty === 'medium' ? (
                  <Trans>Medium</Trans>
                ) : (
                  <Trans>Hard</Trans>
                )
              }
              variant={
                props.model.current()?.difficulty[props.side] === difficulty
                  ? 'solid'
                  : 'outline'
              }
              dataSet={{
                testid: `custom-${props.side}-difficulty-${difficulty}`,
              }}
              operation={() =>
                props.model.choose({
                  operation: 'difficulty',
                  side: props.side,
                  difficulty,
                })
              }
            />
          )}
        </For>
      </GameActions>
    </Show>
  );
}
