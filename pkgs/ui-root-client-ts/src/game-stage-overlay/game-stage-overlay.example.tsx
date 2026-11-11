import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { GamePlayerBar } from '@pkgs/ui-root-client-ts/game-player-bar';
import {
  GAME_VERSUS_AVATAR_SIZE,
  GameResultOverlay,
  type GameResultOverlayProps,
  GameVersusOverlay,
} from '@pkgs/ui-root-client-ts/game-stage-overlay';
import { type JSX, Match, Switch } from 'solid-js';
import { DiscDropBoardExample } from '../../storybook/fixtures/disc-drop-board-example';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

export type GameStageOverlayExampleProps = {
  /** What lies over the board. */
  shown: 'versus' | GameResultOverlayProps['tone'];
  /** Seconds left on the versus card. */
  count: number;
  onSkip: () => void;
  onDismiss: () => void;
  onRematch: () => void;
};

const WORDS = {
  won: { eyebrow: 'Victory', title: 'You won', caption: 'Four in a row.' },
  lost: { eyebrow: 'Defeat', title: 'Atlas won', caption: 'Four in a row.' },
  drawn: {
    eyebrow: 'Draw',
    title: 'Nobody won',
    caption: 'The board is full.',
  },
  neutral: {
    eyebrow: 'Game over',
    title: 'Atlas won',
    caption: 'By resignation.',
  },
} as const;

function Versus(props: GameStageOverlayExampleProps): JSX.Element {
  return (
    <GameVersusOverlay
      others={[
        {
          id: 'yellow',
          name: 'Atlas',
          avatar: <Avatar initials="A" size={GAME_VERSUS_AVATAR_SIZE} />,
          swatch: { color: 'disc-two' },
          caption: 'Yellow · 1487',
        },
      ]}
      own={[
        {
          id: 'red',
          name: 'River',
          avatar: <Avatar initials="R" you size={GAME_VERSUS_AVATAR_SIZE} />,
          swatch: { color: 'disc-one' },
          caption: 'Red · 1512',
        },
      ]}
      mark="VS"
      count={props.count}
      countLabel="Starts in"
      mode="Connect Four · Rated · 5 min"
      skipLabel="Skip"
      aria-label="River versus Atlas. The game is starting."
      onSkip={props.onSkip}
      dataSet={{ testid: 'example-versus' }}
    />
  );
}

function Result(
  props: GameStageOverlayExampleProps & {
    tone: GameResultOverlayProps['tone'];
  }
): JSX.Element {
  return (
    <GameResultOverlay
      tone={props.tone}
      eyebrow={WORDS[props.tone].eyebrow}
      title={WORDS[props.tone].title}
      caption={WORDS[props.tone].caption}
      live
      dismissLabel="Show the board"
      onDismiss={props.onDismiss}
      dataSet={{ testid: 'example-result' }}
      actions={
        <Button
          title="Rematch"
          variant="solid"
          size="sm"
          onClick={() => props.onRematch()}
        />
      }
    />
  );
}

/** The board's two overlays, each over the same held board. */
export default function GameStageOverlayExample(
  props: GameStageOverlayExampleProps
): JSX.Element {
  return (
    <ExampleRoot>
      <GameBoardStage
        others={<GamePlayerBar name="Atlas" />}
        own={<GamePlayerBar name="River" />}
        overlay={
          <Switch>
            <Match when={props.shown === 'versus'}>
              <Versus {...props} />
            </Match>
            <Match when={props.shown !== 'versus' && props.shown}>
              {(tone) => <Result {...props} tone={tone()} />}
            </Match>
          </Switch>
        }
      >
        <DiscDropBoardExample interactive={false} />
      </GameBoardStage>
    </ExampleRoot>
  );
}
