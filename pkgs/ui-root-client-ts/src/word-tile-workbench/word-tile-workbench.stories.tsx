import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Button } from '../button/index';
import { P } from '../text/index';
import { WordTileWorkbench } from './index';

const meta = {
  id: 'product-wordtileworkbench',
  title: 'Games/Word Tiles/Workbench',
  component: WordTileWorkbench,
  tags: ['autodocs'],
} satisfies Meta<typeof WordTileWorkbench>;
export default meta;

/** Long recovery feedback wraps below the turn action at every viewport width. */
export const Recovery: StoryObj = {
  render: () => (
    <WordTileWorkbench>
      <Button title="Play word" />
      <P role="status">
        Scores 10 points. The word list could not load here; the game checks the
        words when you play.
      </P>
    </WordTileWorkbench>
  ),
};
