import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { CatalogueLoadScreenView } from './catalogue-load-screen-view';
import {
  STORY_LOAD_ARGS,
  STORY_LOAD_JOB,
  STORY_SOURCE_MISSING,
  STORY_SOURCE_UPLOADING,
} from './catalogue-load-story.example';

const meta = {
  id: 'screens-puzzles-catalogue-load-routed',
  title: 'Screens/Puzzles/Catalogue load/Routed page',
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
    frame: {
      kind: 'routed',
      parent: { name: 'Settings', href: '/more' },
      onBack: fn(),
    },
  },
} satisfies Meta<typeof CatalogueLoadScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The loader on its own page under Settings: the page's bar names it. */
export const Load: Story = { args: { stage: 'loading', job: STORY_LOAD_JOB } };

/** The file's place on the page: its trail leads back to the loader. */
export const Source: Story = {
  args: { place: { screen: 'source' }, source: STORY_SOURCE_MISSING },
};

/** While the file is saved the page shows only that; Back leaves the loader. */
export const Saving: Story = {
  args: {
    stage: 'saving',
    place: { screen: 'source' },
    source: STORY_SOURCE_UPLOADING,
  },
};
