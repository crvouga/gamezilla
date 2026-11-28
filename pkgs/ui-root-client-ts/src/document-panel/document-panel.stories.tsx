import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './document-panel.example';
import { DocumentPanel } from './index';

const meta = {
  id: 'components-data-display-documentpanel',
  title: 'Organisms/DocumentPanel',
  component: DocumentPanel,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
