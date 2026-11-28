import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ModalContent } from './index';
import Example from './modal.example';

const meta = {
  id: 'components-overlay-modal',
  title: 'Organisms/ModalContent',
  component: ModalContent,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};
