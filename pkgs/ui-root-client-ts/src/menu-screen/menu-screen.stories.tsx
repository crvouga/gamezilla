import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MenuScreen } from './index';
import Example from './menu-screen.example';

const meta = {
  id: 'templates-settings-menu',
  title: 'Templates/MenuScreen',
  component: MenuScreen,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
