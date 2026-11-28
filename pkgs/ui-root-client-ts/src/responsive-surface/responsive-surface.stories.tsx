import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ResponsiveSurface } from './index';
import Example from './responsive-surface.example';

const meta = {
  id: 'components-overlay-responsivesurface',
  title: 'Molecules/ResponsiveSurface',
  component: ResponsiveSurface,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
