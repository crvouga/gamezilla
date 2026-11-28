import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ArrowUpDownIcon } from '../icons';
import { OverflowMenuButton } from './index';
import Example from './overflow-menu-button.example';

const meta = {
  id: 'components-inputs-overflowmenubutton',
  title: 'Molecules/OverflowMenuButton',
  component: OverflowMenuButton,
  tags: ['autodocs'],
} satisfies Meta;
export default meta;

export const States: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => <Example />,
};

/**
 * A labelled trigger, for a menu whose purpose its icon alone does not
 * say: a pack row's Move menu (move up, move down, take out).
 */
export const Labelled: StoryObj = {
  parameters: { controls: { disable: true } },
  render: () => (
    <OverflowMenuButton
      actions={[
        { id: 'up', label: 'Move up', onClick: () => undefined },
        { id: 'down', label: 'Move down', onClick: () => undefined },
      ]}
      aria-label="Move or remove Count to nine"
      icon={ArrowUpDownIcon}
      label="Move"
    />
  ),
};
