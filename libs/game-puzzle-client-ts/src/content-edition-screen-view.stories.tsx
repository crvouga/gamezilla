import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  ContentEditionScreenView,
  type ContentEditionScreenViewProps,
  type ContentEditionSummary,
} from './content-edition-screen-view';
import {
  StoryCountingPlayer,
  StoryPackOverview,
  StoryStartAttempt,
} from './content-story.example';

const PUZZLE: ContentEditionSummary = {
  id: '7c1e0a00-0000-4000-8000-000000000001',
  documentId: '7c1e0a00-0000-4000-8000-0000000000d1',
  kind: 'puzzle',
  title: 'Count to seven',
  difficulty: 'Easy',
  description: 'Reach seven exactly, one or two steps at a time.',
};

const PACK: ContentEditionSummary = {
  id: '7c1e0a00-0000-4000-8000-000000000003',
  documentId: '7c1e0a00-0000-4000-8000-0000000000d3',
  kind: 'pack',
  title: 'Weekend counts',
  difficulty: '',
  description: 'Three puzzles that get harder.',
};

/** Renders the view with a fresh start control and body per mount. */
function render(args: ContentEditionScreenViewProps) {
  return (
    <ContentEditionScreenView
      {...args}
      startAttempt={
        <StoryStartAttempt
          continuing={args.edition?.id === PUZZLE.id && args.canEdit}
          disabled={!args.available}
        />
      }
      body={
        args.edition?.kind === 'pack' ? (
          <StoryPackOverview />
        ) : (
          <StoryCountingPlayer state="0 of 7" disabled />
        )
      }
    />
  );
}

const meta = {
  id: 'screens-puzzles-content-edition',
  title: 'Screens/Puzzles/Content edition',
  component: ContentEditionScreenView,
  tags: ['autodocs'],
  render,
  parameters: {
    appRouter: true,
    controls: {
      exclude: ['edition', 'playDenial', 'startAttempt', 'body'],
    },
  },
  args: {
    edition: PUZZLE,
    available: true,
    canEdit: false,
    onEditWorkingDraft: fn(),
    onReturnToLibrary: fn(),
  },
} satisfies Meta<typeof ContentEditionScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A published puzzle: its preview and a new attempt to start. */
export const Puzzle: Story = {};

/** Its author also sees the way back into the working draft. */
export const Owner: Story = { args: { canEdit: true } };

/** Withdrawn: no new attempts, saved ones continue from the library. */
export const Withdrawn: Story = { args: { available: false } };

/** A pack: its puzzles and the person's progress through them. */
export const Pack: Story = { args: { edition: PACK } };

/** Someone who may not play sees why instead of the preview. */
export const PlayDenied: Story = {
  args: {
    playDenial: {
      icon: KeyRoundIcon,
      title: 'Sign in to play community puzzles',
      body: 'Your attempts are saved to your account.',
      action: { label: 'Sign in', onPress: fn() },
      dataSet: { testid: 'permission-denial', reason: 'requires_account' },
    },
  },
};

/** The edition has not reached this device; the way back is offered. */
export const Missing: Story = { args: { edition: null } };

/** Long titles and descriptions wrap without pushing the layout apart. */
export const LongContent: Story = {
  args: {
    edition: {
      ...PUZZLE,
      title: 'Count all the way to ninety-nine without overshooting even once',
      difficulty: 'Very difficult, for patient counters',
      description:
        'A long description that keeps going to show how the aside behaves when an author writes a paragraph instead of a sentence about their puzzle.',
    },
  },
};

/** The author opens the working draft from the edition. */
export const EditWorkingDraft: Story = {
  args: { canEdit: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('content-edit-working-draft')
    );
    await expect(args.onEditWorkingDraft).toHaveBeenCalled();
  },
};
