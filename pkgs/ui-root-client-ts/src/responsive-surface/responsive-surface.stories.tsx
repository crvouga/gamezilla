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

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
