import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { InspectionWorkspace } from './index';
import Example from './inspection-workspace.example';

const meta = {
  id: 'components-data-display-inspectionworkspace',
  title: 'Organisms/InspectionWorkspace',
  component: InspectionWorkspace,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
