import { StoryPuzzleBuilder } from '@libs/game-puzzle-client-ts/content-builder-story.example';
import { createSignal } from 'solid-js';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { NumberlinkEditorView } from './numberlink-editor';
import { initialNumberlinkDefinition } from './numberlink-editor-actions';
import { FIVE_BY_FIVE } from './numberlink-player.example';
import type { NumberlinkEditorInputs } from './use-numberlink-editor';

/** The Numberlink editor as the stage of the shared puzzle builder. */
function renderInBuilder(args: NumberlinkEditorInputs) {
  return (
    <StoryPuzzleBuilder
      title="Five pairs"
      description="Join every pair without crossing a path."
      difficulty="Medium"
      definition={args.definition}
      earlier="Pairs"
      disabled={args.disabled}
      stage={<NumberlinkEditorView {...args} />}
    />
  );
}

const meta = {
  id: 'screens-games-numberlink-editor',
  title: 'Screens/Games/Numberlink/Editor',
  component: NumberlinkEditorView,
  tags: ['autodocs'],
  render: (args) => renderInBuilder(args),
  parameters: {
    appRouter: true,
    controls: { exclude: ['onChange', 'createId'] },
  },
  args: {
    definition: initialNumberlinkDefinition(),
    disabled: false,
    onChange: fn(),
    createId: () => 'pair-new',
  },
} satisfies Meta<typeof NumberlinkEditorView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A new drawing: three pairs on a three-by-three board. */
export const NewDrawing: Story = {};

/** A larger draft: five pairs, the first chosen for editing. */
export const FiveByFive: Story = {
  args: { definition: JSON.stringify(FIVE_BY_FIVE) },
};

/** Editing feeds accepted placements back into the real builder stage. */
export const EditEndpoints: Story = {
  ...FiveByFive,
  render: (args) => {
    const [definition, setDefinition] = createSignal(args.definition);
    return (
      <StoryPuzzleBuilder
        title="Five pairs"
        description="Join every pair without crossing a path."
        difficulty="Medium"
        definition={definition()}
        earlier="Pairs"
        disabled={args.disabled}
        stage={
          <NumberlinkEditorView
            {...args}
            definition={definition()}
            onChange={setDefinition}
          />
        }
      />
    );
  },
};

/** The selected endpoint stays identifiable independently of focus and pair color. */
export const SelectedSecondEndpoint: Story = {
  ...FiveByFive,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole('radio', { name: 'Second endpoint' })
    );
    await expect(
      canvas.getByTestId('numberlink-board-cell-13')
    ).toHaveAttribute('aria-current', 'true');
    await expect(
      canvas.getByTestId('numberlink-placement-target')
    ).toHaveTextContent('D3');
  },
};

/** No pairs yet: only the board size, coverage and Add pair. */
export const NoPairs: Story = {
  args: { definition: JSON.stringify({ ...FIVE_BY_FIVE, pairs: [] }) },
};

/** While the shared builder saves, nothing can be changed. */
export const Disabled: Story = { args: { disabled: true } };

/** A draft this app cannot read points at an earlier saved draft. */
export const Unreadable: Story = { args: { definition: 'not a drawing' } };

/** An endpoint cannot go on a cell that already holds one: the reason shows. */
export const RefusedEndpoint: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('numberlink-board-cell-3'));
    await expect(
      await canvas.findByText(/already has an endpoint/)
    ).toBeVisible();
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

/** Removing a pair asks first: the confirmation is part of the screen. */
export const ConfirmRemovePair: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Remove pair' })
    );
    await expect(
      await within(canvasElement.ownerDocument.body).findByText(
        'Remove this pair?'
      )
    ).toBeVisible();
  },
};
