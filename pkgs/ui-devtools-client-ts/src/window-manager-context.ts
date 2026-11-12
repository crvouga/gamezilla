import type {
  WindowLayout,
  WindowLayoutCommand,
} from '@pkgs/ui-devtools-shared-ts/window-layout';
import type { OverflowMenuAction } from '@pkgs/ui-root-client-ts/overflow-menu-button';
import { type Accessor, createContext, useContext } from 'solid-js';
import type { WindowDragController } from './window-manager-drag';
import type { WindowPanel } from './window-manager-types';

/** What the parts of one window manager share. */
export type WindowManagerApi = {
  readonly layout: Accessor<WindowLayout>;
  readonly panel: (id: string) => WindowPanel | undefined;
  /** Panels the layout does not show, in the caller's order. */
  readonly closed: Accessor<readonly WindowPanel[]>;
  /** One tab bar for every panel, one window at a time. */
  readonly compact: Accessor<boolean>;
  /**
   * Applies a command. With `focus`, keyboard focus follows the command's
   * panel to its tab (or to the focused window's tab when it closed).
   */
  readonly dispatch: (
    command: WindowLayoutCommand,
    options?: { readonly focus?: boolean | undefined }
  ) => void;
  readonly drag: WindowDragController;
  readonly bounds: () => DOMRect | undefined;
  readonly tabId: (panel: string) => string;
  readonly panelId: (panel: string) => string;
  /** Element that describes the tab keys, for `aria-describedby`. */
  readonly hintId: string;
  readonly registerTab: (panel: string, element: HTMLElement) => void;
  readonly focusPanel: (panel: string) => void;
  /** The caller's rows at the end of every window menu. */
  readonly menuActions: Accessor<readonly OverflowMenuAction[]>;
};

export const WindowManagerContext = createContext<WindowManagerApi>();

export function useWindowManager(): WindowManagerApi {
  const api = useContext(WindowManagerContext);
  if (api === undefined)
    throw new Error('Window manager parts render inside a WindowManager');
  return api;
}
