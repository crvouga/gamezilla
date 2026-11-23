import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ScreenExampleFrame } from '../../storybook/fixtures/screen-example-frame';
import { GameScreen } from '../game-screen/index';
import { Surface } from '../surface/index';
import { P } from '../text/index';
import Example from './game-session-layout.example';
import { GameSessionLayout } from './index';

const meta = {
  id: 'templates-matchmaking-game',
  title: 'Templates/Games/GameSessionLayout',
  component: GameSessionLayout,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};

/**
 * `stageAlign="center"`: on one column, a stage narrower than the column
 * sits in its middle rather than at the start edge.
 */
export const StageCentred: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => (
    <ScreenExampleFrame>
      <GameScreen screenId="example-stage-centred" title="Two crates">
        <GameSessionLayout
          stageAlign="center"
          notices={
            <Surface tone="muted" padding="sm" testId="notices-probe">
              <P>Push each crate onto a goal.</P>
            </Surface>
          }
          actionsBeside
          actions={
            <Surface tone="muted" padding="sm" testId="commands-probe">
              <P>Undo · Redo · Restart</P>
            </Surface>
          }
          aside={
            <Surface tone="muted" padding="sm" testId="rail-probe">
              <P>Puzzle 3 of 4 in Warehouse basics</P>
            </Surface>
          }
        >
          <Surface tone="muted" padding="lg" testId="stage-probe">
            <P>Board</P>
          </Surface>
        </GameSessionLayout>
      </GameScreen>
    </ScreenExampleFrame>
  ),
};

/** One fixed stage, with what may come and go around its board. */
function FixedStage(props: {
  readonly notice?: boolean;
  readonly sheet?: boolean;
  readonly status?: boolean;
}) {
  return (
    <ScreenExampleFrame>
      <GameScreen screenId="example-fixed-stage" title="Two crates">
        <GameSessionLayout
          fixedStage
          actionsBeside
          boardFocus
          notices={
            props.notice === true ? (
              <Surface tone="muted" padding="sm" testId="notices-probe">
                <P>You are offline.</P>
              </Surface>
            ) : undefined
          }
          status={props.status === true ? <P>Your move.</P> : undefined}
          sheet={
            props.sheet === true ? (
              <Surface tone="muted" padding="md" testId="sheet-probe">
                <P>You win</P>
              </Surface>
            ) : undefined
          }
          actions={
            <Surface tone="muted" padding="sm" testId="commands-probe">
              <P>Offer draw · Resign</P>
            </Surface>
          }
          aside={
            <Surface tone="muted" padding="sm" testId="rail-probe">
              <P>1. e4 e5 2. Nf3</P>
            </Surface>
          }
          allMoves={{
            label: 'All moves',
            testId: 'all-moves-probe',
            onPress: () => undefined,
          }}
        >
          <Surface tone="muted" padding="lg" testId="stage-probe">
            <P>Board</P>
          </Surface>
        </GameSessionLayout>
      </GameScreen>
    </ScreenExampleFrame>
  );
}

/**
 * `fixedStage`: every band around the board keeps its height, so nothing
 * that comes or goes moves the board. The line of moves ends in `allMoves`.
 */
export const FixedStageQuiet: StoryObj = {
  tags: ['viewport-responsive'],
  parameters: { controls: { disable: true } },
  render: () => <FixedStage status />,
};

/** A notice lies over the stage's top, not in its flow. */
export const FixedStageNotice: StoryObj = {
  tags: ['viewport-responsive'],
  parameters: { controls: { disable: true } },
  render: () => <FixedStage notice status />,
};

/** A finished game's `sheet` lies over the stage's foot, above the commands. */
export const FixedStageSheet: StoryObj = {
  tags: ['viewport-responsive'],
  parameters: { controls: { disable: true } },
  render: () => <FixedStage sheet />,
};
