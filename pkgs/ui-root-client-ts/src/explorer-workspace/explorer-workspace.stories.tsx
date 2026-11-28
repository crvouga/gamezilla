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

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
