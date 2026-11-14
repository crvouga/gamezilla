import { Plural, Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import {
  GameRulesScreen,
  type GameRulesSection,
} from '@pkgs/ui-root-client-ts/game-rules-screen';
import type { GameTileMotif } from '@pkgs/ui-root-client-ts/game-tile';
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
          {/* The way to play first, then back to every way to play (the
              menu); one row where both fit, the main one on top where not. */}
          <Show when={props.play} keyed>
            {(play) => (
              <Button
                title={play.title}
                intent="primary"
                size="sm"
                onClick={play.onClick}
                dataSet={{ testid: 'game-how-to-play-play' }}
              />
            )}
          </Show>
          <Button
            title={<Trans>All ways to play</Trans>}
            icon={ArrowLeftIcon}
            intent="neutral"
            variant="outline"
            size="sm"
            onClick={props.onBack}
            dataSet={{ testid: 'game-how-to-play-back' }}
          />
        </>
      }
    />
  );
}
