import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './explorer-workspace.example';
import { ExplorerWorkspace } from './index';

const meta = {
  title: 'Components/Data Display/ExplorerWorkspace',
  component: ExplorerWorkspace,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
