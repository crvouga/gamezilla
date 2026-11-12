import type { IconComponent } from '@pkgs/ui-root-client-ts/create-icon';
import type { JSX } from 'solid-js';

/** One panel a window manager can show: a tab and the content behind it. */
export type WindowPanel = {
  /** Stable id; the layout names panels by it. */
  readonly id: string;
  /** Tab label and accessible name of the panel. */
  readonly title: string;
  readonly icon?: IconComponent | undefined;
  /** Offer a close control. Default `true`. */
  readonly closable?: boolean | undefined;
  /**
   * The panel's content. Called once when the panel opens; the element then
   * stays mounted, in place, however the windows are rearranged.
   */
  readonly content: () => JSX.Element;
};

/** Height of a window's tab bar, in px. */
export const WINDOW_TAB_BAR_HEIGHT = 34;

/** Room between two windows, in px; the divider lives in it. */
export const WINDOW_GAP = 6;
