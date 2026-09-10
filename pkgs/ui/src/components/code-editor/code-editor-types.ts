import type { LocalizedString } from '@pkgs/i18n';
import type { JSX } from 'solid-js';
import type { ComponentDataSet } from '../../component-id';
import type { WebKeyboardEventLike } from '../keyboard-shortcuts';

export type CodeTokenKind =
  | 'keyword'
  | 'identifier'
  | 'string'
  | 'number'
  | 'operator'
  | 'comment'
  | 'punctuation'
  | 'param'
  | 'plain';

export type CodeToken = {
  readonly kind: CodeTokenKind;
  readonly start: number;
  readonly end: number;
};

export type CodeSelection = {
  readonly start: number;
  readonly end: number;
};

export type CodeEditorProps = {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly tokenize: (src: string) => readonly CodeToken[];
  /**
   * Keydown hook (fires while the editor is focused, capture phase). Return
   * `true` to `preventDefault` (e.g. to swallow Tab / Escape).
   */
  readonly onKeyDown?:
    | ((ev: WebKeyboardEventLike) => boolean | undefined)
    | undefined;
  /** Caret / selection change (from `select`, `input`, and key/click events). */
  readonly onSelectionChange?: ((selection: CodeSelection) => void) | undefined;
  readonly placeholder?: LocalizedString | undefined;
  readonly autoFocus?: boolean | undefined;
  /** Minimum visible lines. Defaults to 3. */
  readonly minLines?: number | undefined;
  /** Defaults to `true`; `false` renders a read-only textarea. */
  readonly editable?: boolean | undefined;
  readonly 'aria-label'?: LocalizedString | undefined;
  /** Extra classes on the outer wrapper. */
  readonly class?: string | undefined;
  /** Inline styles on the outer wrapper. */
  readonly style?: JSX.CSSProperties | string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  readonly dataSet?: ComponentDataSet | undefined;
  /** Slot rendered under the editor frame (hints, toolbars). */
  readonly trailing?: JSX.Element | undefined;
  /** Textarea element ref (focus / programmatic selection). */
  readonly ref?: ((el: HTMLTextAreaElement) => void) | undefined;
};
