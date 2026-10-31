import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MenuScreen } from './index';
import Example from './menu-screen.example';

const meta = {
  id: 'templates-settings-menu',
  title: 'Templates/Settings menu',
  component: MenuScreen,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
