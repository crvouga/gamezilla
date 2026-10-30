import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './explorer-workspace.example';
import { ExplorerWorkspace } from './index';

const meta = {
  id: 'components-data-display-explorerworkspace',
  title: 'Organisms/ExplorerWorkspace',
  component: ExplorerWorkspace,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
