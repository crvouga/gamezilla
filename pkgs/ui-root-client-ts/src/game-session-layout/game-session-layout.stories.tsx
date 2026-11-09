import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ScreenExampleFrame } from '../../storybook/fixtures/screen-example-frame';
import { GameScreen } from '../game-screen/index';
import { Surface } from '../surface/index';
import { P } from '../text/index';
import Example from './game-session-layout.example';
import { GameSessionLayout } from './index';

const meta = {
  id: 'templates-matchmaking-game',
  title: 'Games/Shared/Screens/GameSessionLayout',
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
