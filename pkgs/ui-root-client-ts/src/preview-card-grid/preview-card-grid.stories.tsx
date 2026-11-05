import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PreviewCardGrid } from './index';
import Example from './preview-card-grid.example';

const meta = {
  id: 'components-data-previewcardgrid',
  title: 'Molecules/PreviewCardGrid',
  component: PreviewCardGrid,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Cards of boards, their titles wrapping; rows in one panel when narrow. */
export const Boards: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
