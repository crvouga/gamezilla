import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PreviewThumbnail } from './index';
import Example from './preview-thumbnail.example';

const meta = {
  id: 'components-data-display-previewthumbnail',
  title: 'Atoms/PreviewThumbnail',
  component: PreviewThumbnail,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** A board preview at row and card size, a pack's stacked sheets, an icon. */
export const Sizes: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
