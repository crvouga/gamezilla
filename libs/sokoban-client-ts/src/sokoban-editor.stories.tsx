import { StoryPuzzleBuilder } from '@libs/game-puzzle-client-ts/content-builder-story.example';
import type { PuzzleEditorProps } from '@libs/game-puzzle-client-ts/puzzle-content-client';
import { initialSokobanDefinition } from '@libs/sokoban-shared-ts/sokoban-board-edits';
import { useArgs } from 'storybook/preview-api';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SokobanEditor } from './sokoban-editor';
import { TWO_CRATES } from './sokoban-player.example';

/** The Sokoban editor as the stage of the shared puzzle builder. */
function renderInBuilder(args: PuzzleEditorProps, onChange = args.onChange) {
  return (
    <StoryPuzzleBuilder
      title="Two crates"
      description="Push both crates onto the goals on the right."
      difficulty="Easy"
      definition={args.definition}
      earlier="Crates"
      disabled={args.disabled}
      stage={<SokobanEditor {...args} onChange={onChange} />}
    />
  );
}

const meta = {
  id: 'screens-games-sokoban-editor',
  title: 'Screens/Games/Sokoban/Editor',
  component: SokobanEditor,
  tags: ['autodocs'],
  render: (args) => renderInBuilder(args),
  parameters: { appRouter: true, controls: { exclude: ['onChange'] } },
  args: {
    definition: initialSokobanDefinition(),
    disabled: false,
    onChange: fn(),
  },
} satisfies Meta<typeof SokobanEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A new board: one worker, one crate, one goal inside walls. */
export const NewBoard: Story = {};

/** A larger draft with two crates and two goals. */
export const TwoCrates: Story = { args: { definition: TWO_CRATES } };

/** Remove the worker and correct the draft with a different worker position. */
export const EditAndCorrect: Story = {
  args: { definition: TWO_CRATES },
  render: (args) => {
    const [, updateArgs] = useArgs();
    return renderInBuilder(args, (definition) => {
      args.onChange(definition);
      updateArgs({ definition });
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('sokoban-tool-erase'));
    await userEvent.click(canvas.getByTestId('sokoban-square-B4'));
    await expect(
      canvas.getByTestId('sokoban-correction-needs_worker')
    ).toBeVisible();
    await userEvent.click(canvas.getByTestId('sokoban-tool-worker'));
    await userEvent.click(canvas.getByTestId('sokoban-square-B3'));
    await expect(canvas.getByTestId('sokoban-ready')).toBeVisible();
    await expect(canvas.getByTestId('sokoban-square-B3')).toHaveAttribute(
      'data-identity',
      'three'
    );
  },
};

/** No worker and more goals than crates: the corrections it needs are listed. */
export const NeedsCorrections: Story = {
  args: {
    definition: JSON.stringify({
      format: 1,
      rows: ['######', '#    #', '# $..#', '#    #', '######'],
    }),
  },
};

/** While the shared builder saves, no tool or square can be used. */
export const Disabled: Story = { args: { disabled: true } };

/** A draft this app cannot read points at an earlier saved draft. */
export const Unreadable: Story = { args: { definition: 'not a board' } };
