import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { Button } from '../button/index';
import { P } from '../text/index';
import { WordTileActions, WordTileWorkbench } from './index';

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

/** The primary stays visible while secondary commands disclose in normal flow. */
export const SecondaryTools: StoryObj = {
  render: () => (
    <WordTileWorkbench>
      <WordTileActions
        label="Word actions"
        moreLabel="Pass, exchange & tools"
        testId="word-tools"
        items={[
          {
            id: 'submit',
            label: 'Play word',
            testId: 'word-tools-submit',
            emphasis: 'primary',
            onPress: fn(),
          },
          {
            id: 'recall',
            label: 'Recall tiles',
            testId: 'word-tools-recall',
            onPress: fn(),
          },
          {
            id: 'undo',
            label: 'Undo',
            testId: 'word-tools-undo',
            disabled: true,
            onPress: fn(),
          },
          {
            id: 'redo',
            label: 'Redo',
            testId: 'word-tools-redo',
            disabled: true,
            onPress: fn(),
          },
          {
            id: 'shuffle',
            label: 'Shuffle rack',
            testId: 'word-tools-shuffle',
            onPress: fn(),
          },
          {
            id: 'pass',
            label: 'Pass',
            testId: 'word-tools-pass',
            onPress: fn(),
          },
          {
            id: 'exchange',
            label: 'Exchange tiles',
            testId: 'word-tools-exchange',
            onPress: fn(),
          },
        ]}
      />
    </WordTileWorkbench>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const more = canvas.getByRole('button', { name: 'Pass, exchange & tools' });
    await expect(more).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(more);
    await expect(
      canvas.getByRole('button', { name: 'Recall tiles' })
    ).toBeVisible();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
  },
};
