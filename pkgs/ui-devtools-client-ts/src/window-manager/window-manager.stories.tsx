import { expect, fireEvent, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { WindowManager } from './index';
import Example, {
  WINDOW_MANAGER_ARRANGEMENTS,
  type WindowManagerExampleProps,
} from './window-manager.example';

const meta = {
  id: 'product-developer-tools-windowmanager',
  title: 'Organisms/WindowManager',
  component: WindowManager,
  tags: ['autodocs'],
  args: {
    arrangement: 'sideBySide',
    compact: false,
    maximized: false,
    closable: true,
    resettable: false,
    onLayoutChange: fn(),
  },
  argTypes: {
    arrangement: {
      control: 'select',
      options: Object.keys(WINDOW_MANAGER_ARRANGEMENTS),
    },
    compact: { control: 'boolean' },
    maximized: { control: 'boolean' },
    closable: { control: 'boolean' },
    resettable: { control: 'boolean' },
  },
  parameters: {
    layout: 'fullscreen',
    controls: {
      include: [
        'arrangement',
        'compact',
        'maximized',
        'closable',
        'resettable',
      ],
    },
  },
  render: (args) => <Example {...args} />,
} satisfies Meta<WindowManagerExampleProps>;
export default meta;

type Story = StoryObj<WindowManagerExampleProps>;

function part(root: HTMLElement, selector: string): HTMLElement {
  const element = root.querySelector<HTMLElement>(selector);
  if (element === null) throw new Error(`missing ${selector}`);
  return element;
}

const tab = (root: HTMLElement, id: string): HTMLElement =>
  part(root, `[data-window-part="tab"][data-panel-id="${id}"]`);

/** Panel ids of each window, in reading order, read from the DOM. */
function windows(root: HTMLElement): string[] {
  return [
    ...root.querySelectorAll<HTMLElement>('[data-window-part="window"]'),
  ].map((element) =>
    [...root.querySelectorAll<HTMLElement>('[data-window-part="tab"]')]
      .filter(
        (item) =>
          item.getAttribute('data-window-id') ===
          element.getAttribute('data-window-id')
      )
      .map((item) => item.getAttribute('data-panel-id'))
      .join(',')
  );
}

/** Drags `id`'s tab to a point given as fractions of the manager's area. */
async function dragTab(
  root: HTMLElement,
  id: string,
  to: { readonly x: number; readonly y: number }
): Promise<void> {
  const shell = tab(root, id).parentElement;
  if (shell === null) throw new Error('tab has no shell');
  const from = shell.getBoundingClientRect();
  const box = part(
    root,
    '[data-window-part="manager"]'
  ).getBoundingClientRect();
  const start = { clientX: from.left + 12, clientY: from.top + 12 };
  const end = {
    clientX: box.left + box.width * to.x,
    clientY: box.top + box.height * to.y,
  };
  const pointer = { pointerId: 1, button: 0, bubbles: true };
  await fireEvent.pointerDown(shell, { ...pointer, ...start });
  await fireEvent.pointerMove(shell, { ...pointer, ...end });
  await expect(part(root, '[data-window-part="drop-preview"]')).toBeVisible();
  await fireEvent.pointerUp(shell, { ...pointer, ...end });
}

/**
 * Two windows side by side, each with its own tab bar. Use the controls to
 * try the other arrangements and modes.
 */
export const SideBySide: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('group', { name: 'Window 1 of 2: Preview' })
    ).toBeVisible();
    await expect(canvas.getAllByRole('tablist')).toHaveLength(2);
    await expect(canvas.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '50'
    );
  },
};

/** One window: every panel is a tab, as in a plain tab bar. */
export const Tabs: Story = { args: { arrangement: 'tabs' } };

/** Splits nest: a wide window over two narrow ones, with uneven sizes. */
export const Stacked: Story = { args: { arrangement: 'stacked' } };

/** A sidebar, a main area and a bottom dock. */
export const Workbench: Story = { args: { arrangement: 'workbench' } };

/**
 * A maximized window covers the others until it is restored; the layout
 * underneath is kept.
 */
export const Maximized: Story = {
  args: { arrangement: 'workbench', maximized: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryAllByRole('separator')).toHaveLength(0);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Restore windows' })
    );
    await expect(canvas.getAllByRole('separator')).toHaveLength(2);
  },
};

/**
 * `compact`: one window at a time and a single tab bar listing every panel.
 * Splitting and dragging are off; the layout is kept for when there is room
 * again.
 */
export const Compact: Story = {
  args: { arrangement: 'workbench', compact: true },
  tags: ['viewport-responsive'],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('tablist')).toHaveLength(1);
    await expect(canvas.getAllByRole('tab')).toHaveLength(5);
    await userEvent.click(canvas.getByRole('tab', { name: 'Logs' }));
    await expect(canvas.getByRole('tabpanel', { name: 'Logs' })).toBeVisible();
  },
};

/** Panels without close controls: they can be arranged but not closed. */
export const Pinned: Story = {
  args: { closable: false },
  play: async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelector('[data-window-part="close"]')
    ).toBeNull();
  },
};

/** Every panel closed: the empty state offers each of them. */
export const Empty: Story = {
  args: { arrangement: 'empty' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('No panels are open')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Logs' }));
    await expect(canvas.getByRole('tab', { name: 'Logs' })).toHaveFocus();
  },
};

/**
 * Dragging a tab onto the edge of a window opens a new window on that side;
 * dragging it onto a tab bar puts it back among the tabs.
 */
export const DragToSplitAndBack: Story = {
  play: async ({ canvasElement }) => {
    await dragTab(canvasElement, 'tests', { x: 0.25, y: 0.95 });
    await expect(windows(canvasElement)).toEqual([
      'preview',
      'tests',
      'console,data,logs',
    ]);
    const bar = tab(canvasElement, 'console').getBoundingClientRect();
    const box = part(
      canvasElement,
      '[data-window-part="manager"]'
    ).getBoundingClientRect();
    await dragTab(canvasElement, 'tests', {
      x: (bar.left + 4 - box.left) / box.width,
      y: (bar.top + 8 - box.top) / box.height,
    });
    await expect(windows(canvasElement)).toEqual([
      'preview',
      'tests,console,data,logs',
    ]);
  },
};

/**
 * The same arrangements from the keyboard: switch, reorder, cross to the
 * next window, move a panel across, and split when there is no window on
 * that side.
 */
export const ArrangeWithKeys: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    tab(canvasElement, 'preview').focus();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('tab', { name: 'Tests' })).toHaveFocus();
    await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    await expect(windows(canvasElement)[0]).toBe('tests,preview');
    await userEvent.keyboard('{Alt>}{ArrowRight}{/Alt}');
    await expect(canvas.getByRole('tab', { name: 'Console' })).toHaveFocus();
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowLeft}{/Shift}{/Alt}');
    await expect(windows(canvasElement)).toEqual([
      'tests,preview,console',
      'data,logs',
    ]);
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowDown}{/Shift}{/Alt}');
    await expect(windows(canvasElement)).toEqual([
      'tests,preview',
      'console',
      'data,logs',
    ]);
    await expect(canvas.getByRole('status')).toHaveTextContent(
      'Console moved to a new window below'
    );
  },
};

/**
 * Every window has a menu with the same moves: split on a side, send the
 * panel to a neighbour, maximize, even the sizes, close.
 */
export const ArrangeWithMenu: Story = {
  args: { arrangement: 'tabs' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Window actions' })
    );
    await userEvent.click(
      await page.findByRole('menuitem', { name: 'Split right' })
    );
    await expect(windows(canvasElement)).toEqual([
      'console,tests,data,logs',
      'preview',
    ]);
    await expect(canvas.getByRole('tab', { name: 'Preview' })).toHaveFocus();
  },
};

/**
 * A divider is a window splitter: arrows resize, Shift takes a larger step,
 * Home and End go to the limits, Enter evens the split.
 */
export const ResizeWithKeys: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const separator = canvas.getByRole('separator');
    separator.focus();
    await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    await expect(canvas.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '40'
    );
    await userEvent.keyboard('{End}');
    await expect(canvas.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      '90'
    );
  },
};

/**
 * Closing a panel unmounts it and lists it under "Open a panel"; a window
 * that loses its last tab closes and its neighbours take the room.
 */
export const CloseAndReopen: Story = {
  args: { arrangement: 'stacked' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      part(canvasElement, '[data-window-part="close"][data-panel-id="preview"]')
    );
    await expect(windows(canvasElement)).toEqual([
      'console,tests',
      'data,logs',
    ]);
    await userEvent.click(
      part(canvasElement, '[data-window-part="open-menu"]')
    );
    await userEvent.click(
      await page.findByRole('menuitem', { name: 'Preview' })
    );
    await expect(canvas.getByRole('tab', { name: 'Preview' })).toHaveFocus();
  },
};

/**
 * `menuActions` adds the caller's rows to every window menu -- here, a way
 * back to the starting layout.
 */
export const HostMenuActions: Story = {
  args: { resettable: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.dblClick(
      part(canvasElement, '[data-window-part="tab-bar"]')
    );
    await expect(canvas.getAllByRole('tablist')).toHaveLength(1);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Window actions' })
    );
    await userEvent.click(
      await page.findByRole('menuitem', { name: 'Reset layout' })
    );
    await expect(canvas.getAllByRole('tablist')).toHaveLength(2);
  },
};
