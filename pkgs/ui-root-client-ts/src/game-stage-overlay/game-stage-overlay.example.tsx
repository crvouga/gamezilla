import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { GamePlayerBar } from '@pkgs/ui-root-client-ts/game-player-bar';
import {
  GameResultOverlay,
  type GameResultOverlayProps,
} from '@pkgs/ui-root-client-ts/game-stage-overlay';
import type { JSX } from '@solidjs/web';
import { DiscDropBoardExample } from '../../storybook/fixtures/disc-drop-board-example';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

export type GameStageOverlayExampleProps = {
  tone: GameResultOverlayProps['tone'];
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

function Result(props: GameStageOverlayExampleProps): JSX.Element {
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

/** The board with its result and rematch action. */
export default function GameStageOverlayExample(
  props: GameStageOverlayExampleProps
): JSX.Element {
  return (
    <ExampleRoot>
      <GameBoardStage
        others={<GamePlayerBar name="Atlas" />}
        own={<GamePlayerBar name="River" />}
        overlay={<Result {...props} />}
      >
        <DiscDropBoardExample interactive={false} />
      </GameBoardStage>
    </ExampleRoot>
  );
}
