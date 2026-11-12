import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import Example from './context-menu.example';
import { ContextMenu } from './index';

const meta = {
  id: 'components-overlays-contextmenu',
  title: 'Molecules/ContextMenu',
  component: ContextMenu,
  tags: ['autodocs'],
  parameters: { controls: { disable: true } },
} satisfies Meta;
export default meta;

/** A right-click on the page: going back and forward, reloading, the page link, printing, and reporting a bug. */
export const Page: StoryObj = { render: () => <Example state="page" /> };

/** A right-click on selected words adds copying, searching the web and selecting all. */
export const Selection: StoryObj = {
  render: () => <Example state="selection" />,
};

/** A right-click in a field: undo and redo, cut, copy, paste, select all. */
export const Field: StoryObj = { render: () => <Example state="field" /> };

/** Paste was not allowed: the menu says so plainly and offers the keyboard instead. */
export const PasteRefused: StoryObj = {
  render: () => <Example state="paste-refused" />,
};

/** A right-click on a picture that is a link: the link and the picture each get their group. */
export const LinkedImage: StoryObj = {
  render: () => <Example state="linked-image" />,
};
