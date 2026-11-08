import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { GameScreen } from '../game-screen/index';
import { Surface } from '../surface/index';
import { P } from '../text/index';

const meta = {
  id: 'templates-game-compact-inset',
  title: 'Templates/Game compact inset',
  component: GameScreen,
  parameters: { layout: 'fullscreen' },
} satisfies Meta;
export default meta;

function Workspace(props: { narrow: boolean }) {
  return (
    <ExampleRoot grow>
      <GameScreen
        screenId="precision-inset"
        title="Precision board"
        compactInset={props.narrow ? 'narrow' : 'standard'}
      >
        <Surface
          tone="muted"
          padding="sm"
          dataSet={{ testid: 'precision-workspace' }}
        >
          <P>Board workspace</P>
          <P>The frame keeps one scroll owner and a readable board edge.</P>
        </Surface>
      </GameScreen>
    </ExampleRoot>
  );
}

export const Standard: StoryObj = {
  render: () => <Workspace narrow={false} />,
};
export const Narrow: StoryObj = { render: () => <Workspace narrow /> };
