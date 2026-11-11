import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { CatalogueLoadScreenView } from './catalogue-load-screen-view';
import { STORY_LOAD_ARGS } from './catalogue-load-story.example';

const meta = {
  id: 'screens-puzzles-catalogue-load-status',
  title: 'Screens/Puzzles/Catalogue load/Status',
  component: CatalogueLoadScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: {
      exclude: ['frame', 'copy', 'place', 'denial', 'job', 'source'],
    },
  },
  args: {
    ...STORY_LOAD_ARGS,
    stage: 'denied',
    place: { screen: 'status' },
    pool: null,
    denial: {
      icon: KeyRoundIcon,
      title: 'Only the puzzle team can load puzzles',
      dataSet: { testid: 'permission-denial', reason: 'not_granted' },
    },
  },
} satisfies Meta<typeof CatalogueLoadScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Anyone outside the puzzle team is told why, and shown nothing of the load. */
export const Denied: Story = {};

/** Denied while offline: the denial alone, with no connection notice over it. */
export const DeniedOffline: Story = { args: { link: 'offline' } };
