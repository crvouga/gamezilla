/** @jsxImportSource solid-js */
/**
 * `CodeEditor` -- multiline monospace editor with overlay syntax highlighting.
 *
 * A transparent `<textarea>` sits over a token-colored `<pre>` mirror so the
 * caret and selection stay native while highlighting is plain spans. Both
 * layers share font metrics (`tokens.fonts.mono`, 13px / 20px) and padding.
 *
 * @example
 * ```tsx
 * <CodeEditor value={src()} onChangeText={setSrc} tokenize={tokenizeDsl} />
 * ```
 */

import {
  createMemo,
  createSignal,
  For,
  type JSX,
  Show,
  splitProps,
} from 'solid-js';
import { componentDataAttrs } from '../../component-id';
import { type SxProps, spacingScale, useThemeTokens } from '../../theme';
import { Box } from '../box';
import { useDocumentShortcuts } from '../keyboard-shortcuts';
import styles from './code-editor.module.css';
import {
  buildHighlightSegments,
  CODE_EDITOR_DEFAULT_MIN_LINES,
  CODE_EDITOR_FONT_SIZE,
  CODE_EDITOR_LINE_HEIGHT,
  CODE_EDITOR_PAD,
  editorFrameHeight,
  type HighlightSegment,
} from './code-editor-highlight';
import type {
  CodeEditorProps,
  CodeSelection,
  CodeTokenKind,
} from './code-editor-types';

const TOKEN_CLASS: Record<CodeTokenKind, string | undefined> = {
  keyword: styles['tokKeyword'],
  identifier: styles['tokIdentifier'],
  string: styles['tokString'],
  number: styles['tokNumber'],
  operator: styles['tokOperator'],
  comment: styles['tokComment'],
  punctuation: styles['tokPunctuation'],
  param: styles['tokParam'],
  plain: styles['tokPlain'],
};

function layerSx(mono: string): SxProps {
  return {
    px: CODE_EDITOR_PAD,
    py: CODE_EDITOR_PAD,
    fontFamily: mono,
    fontSize: CODE_EDITOR_FONT_SIZE,
    lineHeight: CODE_EDITOR_LINE_HEIGHT,
  };
}

function HighlightMirror(props: {
  segments: readonly HighlightSegment[];
  style: string | undefined;
}): JSX.Element {
  return (
    <pre
      class={styles['mirror']}
      style={props.style}
      aria-hidden="true"
      data-component="CodeEditorMirror"
    >
      <For each={props.segments}>
        {(seg) => <span class={TOKEN_CLASS[seg.kind]}>{seg.text}</span>}
      </For>
    </pre>
  );
}

function readSelection(el: HTMLTextAreaElement): CodeSelection {
  return { start: el.selectionStart, end: el.selectionEnd };
}

type FieldProps = Pick<
  CodeEditorProps,
  | 'value'
  | 'onChangeText'
  | 'onSelectionChange'
  | 'placeholder'
  | 'autoFocus'
  | 'editable'
  | 'aria-label'
  | 'ref'
> & {
  style: string | undefined;
  onFocusChange: (focused: boolean) => void;
};

function EditorField(props: FieldProps): JSX.Element {
  const emitSelection = (el: HTMLTextAreaElement): void => {
    props.onSelectionChange?.(readSelection(el));
  };
  return (
    <textarea
      ref={props.ref}
      class={styles['field']}
      style={props.style}
      value={props.value}
      readOnly={props.editable === false}
      autofocus={props.autoFocus}
      autocapitalize="off"
      autocomplete="off"
      autocorrect="off"
      spellcheck={false}
      placeholder={props.placeholder}
      aria-label={props['aria-label']}
      onInput={(event) => {
        props.onChangeText(event.currentTarget.value);
        emitSelection(event.currentTarget);
      }}
      onSelect={(event) => emitSelection(event.currentTarget)}
      onKeyUp={(event) => emitSelection(event.currentTarget)}
      onClick={(event) => emitSelection(event.currentTarget)}
      onFocus={() => props.onFocusChange(true)}
      onBlur={() => props.onFocusChange(false)}
      {...componentDataAttrs('CodeEditorField', undefined)}
    />
  );
}

export function CodeEditor(props: CodeEditorProps): JSX.Element {
  const tokens = useThemeTokens();
  const [focused, setFocused] = createSignal(false);
  const [field] = splitProps(props, [
    'value',
    'onChangeText',
    'onSelectionChange',
    'placeholder',
    'autoFocus',
    'editable',
    'aria-label',
    'ref',
  ]);
  const segments = createMemo(() =>
    buildHighlightSegments(props.value, props.tokenize(props.value))
  );
  const height = (): number =>
    editorFrameHeight(
      props.value,
      props.minLines ?? CODE_EDITOR_DEFAULT_MIN_LINES,
      spacingScale(CODE_EDITOR_PAD)
    );
  const layerStyle = (): string | undefined =>
    tokens.css(layerSx(tokens.fonts.mono)) || undefined;

  useDocumentShortcuts({
    enabled: () => focused() && props.onKeyDown !== undefined,
    onKeyDown: (ev) => props.onKeyDown?.(ev) === true,
  });

  return (
    <Box
      sx={[{ gap: 1 }, props.sx]}
      dataSet={{ component: 'CodeEditor', ...props.dataSet }}
    >
      <Box
        sx={{
          position: 'relative',
          minHeight: height(),
          height: height(),
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: focused() ? 'tint' : 'outline',
          borderRadius: 'md',
          backgroundColor: 'surfaceMuted',
          overflow: 'hidden',
        }}
      >
        <HighlightMirror segments={segments()} style={layerStyle()} />
        <EditorField
          {...field}
          style={layerStyle()}
          onFocusChange={setFocused}
        />
      </Box>
      <Show when={props.trailing}>{props.trailing}</Show>
    </Box>
  );
}
