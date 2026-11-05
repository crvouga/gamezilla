import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { StickyActionBar } from './index';
import Example from './sticky-action-bar.example';

const meta = {
  id: 'components-inputs-stickyactionbar',
  title: 'Molecules/StickyActionBar',
  component: StickyActionBar,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** The step that finishes a builder: its title, an outline and a filled step. */
export const PublishStep: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
