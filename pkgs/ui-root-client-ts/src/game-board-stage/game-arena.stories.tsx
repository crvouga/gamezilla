import { useArgs } from 'storybook/preview-api';
import { expect, fn, mocked, userEvent, waitFor, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './game-arena.example';
import { GameBoardStage } from './index';

const meta = {
  id: 'product-game-arena',
  title: 'Games/Shared/Components/GameArena',
  component: GameBoardStage,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** The custom arg configures the nested board through native Controls. */
export const States: StoryObj<{ boardInteractive: boolean }> = {
  args: { boardInteractive: true },
  argTypes: {
    boardInteractive: {
      control: 'boolean',
      description: 'Enable column choices in the composed board example.',
    },
  },
  parameters: { controls: { include: ['boardInteractive'] } },
  render: (args) => <Example boardInteractive={args.boardInteractive} />,
};
type SearchArgs = {
  boardInteractive: boolean;
  searching: boolean;
  onSearchingChange: (searching: boolean) => void;
};

/** The search region is visible immediately, including its recovery action. */
export const Searching: StoryObj<SearchArgs> = {
  args: { boardInteractive: true, searching: true, onSearchingChange: fn() },
  argTypes: {
    boardInteractive: { control: 'boolean' },
    searching: { control: 'boolean' },
    onSearchingChange: { control: false },
  },
  parameters: {
    test: { restoreMocks: false },
    controls: { include: ['boardInteractive', 'searching'] },
  },
  render: (args) => {
    const [, updateArgs] = useArgs();
    return (
      <Example
        boardInteractive={args.boardInteractive}
        searching={args.searching}
        onSearchingChange={(searching) => {
          args.onSearchingChange(searching);
          updateArgs({ searching });
        }}
      />
    );
  },
};

/** Starting and cancelling a search preserves the selected round length. */
export const SearchAndCancel: StoryObj<SearchArgs> = {
  ...Searching,
  args: { ...Searching.args, searching: false },
  play: async ({ canvasElement, args, step }) => {
    mocked(args.onSearchingChange).mockClear();
    const canvas = within(canvasElement);
    await step('Start searching for a rival', async () => {
      await userEvent.click(
        canvas.getByRole('radio', { name: '2 min Quick round' })
      );
      await userEvent.click(
        canvas.getByRole('button', { name: 'Find a rival' })
      );
      await expect(
        await canvas.findByRole('heading', { name: 'Finding a rival' })
      ).toBeVisible();
      await expect(args.onSearchingChange).toHaveBeenLastCalledWith(true);
    });
    await step('Cancel and retain the selected pace', async () => {
      await userEvent.click(
        canvas.getByRole('button', { name: 'Stop searching' })
      );
      await waitFor(() =>
        expect(
          canvas.queryByRole('heading', { name: 'Finding a rival' })
        ).not.toBeInTheDocument()
      );
      await expect(
        canvas.getByRole('radio', { name: '2 min Quick round' })
      ).toBeChecked();
      await expect(args.onSearchingChange).toHaveBeenLastCalledWith(false);
    });
  },
};
