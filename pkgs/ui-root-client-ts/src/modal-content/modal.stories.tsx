import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ModalContent } from './index';
import Example from './modal.example';

const meta = {
  id: 'components-overlay-modal',
  title: 'Organisms/Modal',
  component: ModalContent,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

/** Representative variants, themes and interaction states from the production contract. */
export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
