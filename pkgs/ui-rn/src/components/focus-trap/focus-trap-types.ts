import type { PropsWithChildren } from 'react';
import type { SxInput } from '../../theme';

export type FocusTrapProps = PropsWithChildren<{
  /** When true, trap Tab focus inside the subtree (web only). */
  active: boolean;
  /** Move focus into the trap on activate. Default `true`. */
  autoFocus?: boolean;
  /** Restore focus to the prior element on deactivate. Default `true`. */
  returnFocus?: boolean;
  /**
   * Called on Escape while this trap is the innermost active overlay
   * (web only). Use to dismiss modals, sheets, and menus.
   */
  onEscape?: () => void;
  /** Optional accessible name for the dialog host (web). */
  accessibilityLabel?: string;
  /**
   * Runtime layout (web).
   * - `cover` (default): absolute-fill for full-screen modal backdrops.
   * - `sheet`: in-flow stretch for bottom sheets (absolute-fill hides content).
   */
  layout?: 'cover' | 'sheet';
  /** Extra `sx` on the web host (merged after layout defaults). */
  sx?: SxInput;
}>;
