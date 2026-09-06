import type { ReactNode } from 'react';
import type { ComponentDataSet } from '../../component-id';
import type { SxInput } from '../../theme';
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
  readonly onKeyDown?: (ev: WebKeyboardEventLike) => boolean | void;
  readonly onSelectionChange?: (selection: CodeSelection) => void;
  readonly placeholder?: string;
  readonly autoFocus?: boolean;
  readonly minLines?: number;
  readonly editable?: boolean;
  readonly accessibilityLabel?: string;
  readonly sx?: SxInput;
  readonly dataSet?: ComponentDataSet;
  readonly trailing?: ReactNode;
};
