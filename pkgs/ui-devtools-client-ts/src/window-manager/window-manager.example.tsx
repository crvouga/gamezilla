/** @jsxImportSource solid-js */

import { WindowManager } from '@pkgs/ui-devtools-client-ts/window-manager';
import type { WindowPanel } from '@pkgs/ui-devtools-client-ts/window-manager-types';
import {
  applyWindowLayoutCommand,
  createWindowLayout,
  type WindowLayout,
  type WindowLayoutCommand,
  type WindowLayoutSpec,
} from '@pkgs/ui-devtools-shared-ts/window-layout';
import { serializeWindowLayout } from '@pkgs/ui-devtools-shared-ts/window-layout-codec';
import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import {
  DatabaseIcon,
  FlaskConicalIcon,
  MonitorPlayIcon,
  PaintbrushIcon,
  ScrollTextIcon,
  TerminalIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { createSignal, type JSX, untrack } from 'solid-js';
import { ExampleRoot } from '../../../ui-root-client-ts/storybook/fixtures/example-root';

/** Named starting arrangements of the six demo panels. */
export const WINDOW_MANAGER_ARRANGEMENTS = {
  /** One window, every panel a tab. */
  tabs: ['preview', 'console', 'tests', 'data', 'logs'],
  /** Two windows next to each other. */
  sideBySide: {
    direction: 'row',
    children: [
      ['preview', 'tests'],
      ['console', 'data', 'logs'],
    ],
  },
  /** A wide window over two narrow ones. */
  stacked: {
    direction: 'column',
    sizes: [3, 2],
    children: [
      ['preview'],
      {
        direction: 'row',
        children: [
          ['console', 'tests'],
          ['data', 'logs'],
        ],
      },
    ],
  },
  /** A sidebar, a main area and a bottom dock. */
  workbench: {
    direction: 'row',
    sizes: [1, 3],
    children: [
      ['data'],
      {
        direction: 'column',
        sizes: [2, 1],
        children: [
          ['preview', 'tests'],
          ['console', 'logs'],
        ],
      },
    ],
  },
  /** Nothing open. */
  empty: [],
} as const satisfies Readonly<Record<string, WindowLayoutSpec>>;

export type WindowManagerArrangement = keyof typeof WINDOW_MANAGER_ARRANGEMENTS;

export type WindowManagerExampleProps = {
  /** The arrangement the example starts from. */
  readonly arrangement?: WindowManagerArrangement | undefined;
  /** One window at a time, every panel in one tab bar. */
  readonly compact?: boolean | undefined;
  /** Start with the focused window maximized. */
  readonly maximized?: boolean | undefined;
  /** Offer close controls. `false` pins every panel open. */
  readonly closable?: boolean | undefined;
  /** Add a "Reset layout" row to every window menu. */
  readonly resettable?: boolean | undefined;
  readonly onLayoutChange?:
    | ((layout: WindowLayout, command: WindowLayoutCommand) => void)
    | undefined;
};

type Demo = {
  readonly id: string;
  readonly title: string;
  readonly icon: IconComponent;
  readonly body: string;
};

const DEMOS: readonly Demo[] = [
  {
    id: 'preview',
    title: 'Preview',
    icon: MonitorPlayIcon,
    body: 'Drag my tab onto another window, or onto an edge to split.',
  },
  {
    id: 'console',
    title: 'Console',
    icon: TerminalIcon,
    body: 'Alt + arrow goes to the next window. Alt + Shift + arrow moves me there.',
  },
  {
    id: 'tests',
    title: 'Tests',
    icon: FlaskConicalIcon,
    body: 'Shift + Left or Right reorders my tab. Delete closes me.',
  },
  {
    id: 'data',
    title: 'Data',
    icon: DatabaseIcon,
    body: 'The plus button in a tab bar reopens closed panels.',
  },
  {
    id: 'logs',
    title: 'Logs',
    icon: ScrollTextIcon,
    body: 'Double-click a tab bar to maximize its window.',
  },
  {
    id: 'theme',
    title: 'Theme',
    icon: PaintbrushIcon,
    body: 'I start closed: open me from the plus button.',
  },
];

function DemoContent(props: { readonly demo: Demo }): JSX.Element {
  const [count, setCount] = createSignal(0);
  return (
    <div class="box flex-1 gap-3 p-4">
      <p class="text textLabel text-text">{props.demo.title}</p>
      <p class="text textBody text-text-secondary">{props.demo.body}</p>
      <button
        type="button"
        class="clickable clickableTint self-start px-3 py-2 rounded-control border border-solid border-border"
        onClick={() => setCount((value) => value + 1)}
      >
        <span class="text textBody text-text">
          {`${props.demo.title} kept its state: ${String(count())}`}
        </span>
      </button>
    </div>
  );
}

function startLayout(
  arrangement: WindowManagerArrangement,
  maximized: boolean
): WindowLayout {
  const layout = createWindowLayout(WINDOW_MANAGER_ARRANGEMENTS[arrangement]);
  return maximized && layout.focused !== null
    ? applyWindowLayoutCommand(layout, {
        type: 'maximize',
        window: layout.focused,
      })
    : layout;
}

/**
 * A workspace of six demo panels (five open, "Theme" closed). Each panel has
 * a counter, to show that a panel keeps its state however it is moved. The
 * line under the workspace is the serialized layout.
 */
export default function WindowManagerExample(
  props: WindowManagerExampleProps
): JSX.Element {
  const initial = (): WindowLayout =>
    startLayout(props.arrangement ?? 'sideBySide', props.maximized === true);
  const [layout, setLayout] = createSignal(untrack(initial));
  const panels = (): WindowPanel[] =>
    DEMOS.map((demo) => ({
      id: demo.id,
      title: demo.title,
      icon: demo.icon,
      closable: props.closable !== false,
      content: () => <DemoContent demo={demo} />,
    }));
  return (
    <ExampleRoot bounded gap="none">
      <WindowManager
        aria-label="Workspace"
        panels={panels()}
        layout={layout()}
        compact={props.compact}
        menuActions={
          props.resettable === true
            ? [
                {
                  id: 'reset',
                  label: 'Reset layout',
                  onClick: () => setLayout(initial()),
                },
              ]
            : undefined
        }
        onLayoutChange={(next, command) => {
          setLayout(next);
          props.onLayoutChange?.(next, command);
        }}
      />
      <p
        class="text textCaption shrink-0 px-3 py-2 border-t border-border text-text-secondary line-clamp-1"
        data-testid="layout"
      >
        {serializeWindowLayout(layout())}
      </p>
    </ExampleRoot>
  );
}
