import { Plural, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import {
  GameRulesScreen,
  type GameRulesSection,
} from '@pkgs/ui-root-client-ts/game-rules-screen';
import type { GameTileMotif } from '@pkgs/ui-root-client-ts/game-tile';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import { ArrowLeftIcon } from '@pkgs/ui-root-client-ts/icons';
import { type JSX, Show } from 'solid-js';

/** The way to play that the rules lead on to: the menu's main way in. */
export type GameHowToPlayNext = {
  readonly title: JSX.Element;
  readonly onClick: () => void;
};

/**
 * How a game is played, on a screen of its own behind the game's menu: the
 * game's picture and name, its rules in numbered parts at a reading
 * measure, then what to do next, in one slim row: back to the menu by its
 * arrow, or start playing the menu's main way in. The host's Back returns to the menu too.
 */
export function GameHowToPlayView(props: {
  /** The game's name. */
  title: string;
  tile: GameTileMotif;
  /** One line under the name: what the game is. */
  subtitle: JSX.Element;
  /** The game's own rules, in the order they are learned. */
  rules: readonly GameRulesSection[];
  /** The main way to play, when the game offers one. */
  play?: GameHowToPlayNext | undefined;
  onBack: () => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <GameRulesScreen
      screenId="game-how-to-play"
      // How much there is to read, before reading it.
      eyebrow={
        <Plural
          value={props.rules.length}
          one="How to play · # part"
          other="How to play · # parts"
        />
      }
      title={props.title}
      motif={props.tile}
      subtitle={props.subtitle}
      sections={props.rules}
      dataSet={{ testid: 'game-how-to-play' }}
      actions={
        <>
          {/* One slim row on every width: Back by its arrow (named for
              where it leads), the way to play taking the rest. */}
          <IconButton
            label={t`Back to ${props.title}`}
            background="surface"
            onClick={props.onBack}
            dataSet={{ testid: 'game-how-to-play-back' }}
          >
            <ArrowLeftIcon size={18} />
          </IconButton>
          <Show when={props.play} keyed>
            {(play) => (
              <Button
                title={play.title}
                intent="primary"
                size="sm"
                flex={1}
                onClick={play.onClick}
                dataSet={{ testid: 'game-how-to-play-play' }}
              />
            )}
          </Show>
        </>
      }
    />
  );
}
