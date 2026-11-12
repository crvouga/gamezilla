/** @jsxImportSource solid-js */

import { useLingui } from '@lingui/solid/macro';
import type {
  WindowEdge,
  WindowLayoutCommand,
} from '@pkgs/ui-devtools-shared-ts/window-layout';

export type WindowManagerText = {
  readonly hint: () => string;
  readonly windowLabel: (at: {
    readonly position: number;
    readonly count: number;
    readonly title: string;
  }) => string;
  readonly tabsLabel: (position: number) => string;
  readonly splitLabel: (edge: WindowEdge) => string;
  readonly moveLabel: (edge: WindowEdge) => string;
  /** What a finished command says in the live region; `null` says nothing. */
  readonly announce: (
    command: WindowLayoutCommand,
    title: string
  ) => string | null;
};

/** The words of a window manager: labels, key hints and announcements. */
export function useWindowManagerText(): WindowManagerText {
  const { t } = useLingui();
  const splitLabel = (edge: WindowEdge): string =>
    ({
      left: t`Split left`,
      right: t`Split right`,
      top: t`Split up`,
      bottom: t`Split down`,
    })[edge];
  const moveLabel = (edge: WindowEdge): string =>
    ({
      left: t`Move to the window on the left`,
      right: t`Move to the window on the right`,
      top: t`Move to the window above`,
      bottom: t`Move to the window below`,
    })[edge];
  const splitDone = (edge: WindowEdge, title: string): string =>
    ({
      left: t`${title} moved to a new window on the left`,
      right: t`${title} moved to a new window on the right`,
      top: t`${title} moved to a new window above`,
      bottom: t`${title} moved to a new window below`,
    })[edge];
  return {
    hint: () =>
      t`Left and Right Arrow switch tabs. Shift with Left or Right reorders the tab. Alt with an arrow goes to the window on that side. Alt and Shift with an arrow moves the panel to that side. Delete closes the panel. Down Arrow enters it.`,
    windowLabel: ({ position, count, title }) =>
      t`Window ${position} of ${count}: ${title}`,
    tabsLabel: (position) => t`Tabs of window ${position}`,
    splitLabel,
    moveLabel,
    announce: (command, title) => {
      if (command.type === 'move') return t`${title} moved`;
      if (command.type === 'split') return splitDone(command.edge, title);
      if (command.type === 'open') return t`${title} opened`;
      if (command.type === 'close') return t`${title} closed`;
      if (command.type === 'maximize') return t`Window maximized`;
      if (command.type === 'restore') return t`Windows restored`;
      if (command.type === 'equalize') return t`Windows evened out`;
      return null;
    },
  };
}
