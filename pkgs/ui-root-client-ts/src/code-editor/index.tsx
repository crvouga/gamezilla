/** @jsxImportSource solid-js */

import type { HighlightSegment } from '@pkgs/ui-root-shared-ts/code-editor-highlight';
import {
  buildHighlightSegments,
  CODE_EDITOR_DEFAULT_MIN_LINES,
  CODE_EDITOR_FONT_SIZE,
  CODE_EDITOR_LINE_HEIGHT,
  CODE_EDITOR_PAD,
  editorFrameHeight,
} from '@pkgs/ui-root-shared-ts/code-editor-highlight';
import type {
  CodeEditorProps,
  CodeSelection,
  CodeTokenKind,
} from '@pkgs/ui-root-shared-ts/code-editor-types';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { colorVar } from '@pkgs/ui-root-shared-ts/css-vars';
import { spacingScale } from '@pkgs/ui-root-shared-ts/scale';
import {
  createMemo,
  createSignal,
  For,
  type JSX,
  Show,
  splitProps,
} from 'solid-js';
import { useThemeTokens } from '../theme-context/index';
import { useDocumentShortcuts } from '../use-document-shortcuts';
import styles from './code-editor.module.css';

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

function layerStyle(mono: string): JSX.CSSProperties {
  const pad = spacingScale(CODE_EDITOR_PAD);
  return {
    'padding-left': `${pad}px`,
    'padding-right': `${pad}px`,
    'padding-top': `${pad}px`,
    'padding-bottom': `${pad}px`,
    'font-family': mono,
    'font-size': `${CODE_EDITOR_FONT_SIZE}px`,
    'line-height': `${CODE_EDITOR_LINE_HEIGHT}px`,
  };
}

function HighlightMirror(props: {
  segments: readonly HighlightSegment[];
  style: JSX.CSSProperties;
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
  style: JSX.CSSProperties;
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
      data-component="CodeEditorField"
    />
  );
}

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
  const layer = (): JSX.CSSProperties => layerStyle(tokens.fonts.mono);

  useDocumentShortcuts({
    enabled: () => focused() && props.onKeyDown !== undefined,
    onKeyDown: (ev) => props.onKeyDown?.(ev) === true,
  });

  return (
    <div
      class="box gap-1"
      classList={{ [String(props.class)]: true }}
      {...dataAttrs({ component: 'CodeEditor', ...props.dataSet })}
      style={props.style}
    >
      <div
        class="box relative border border-solid rounded-control bg-surface-muted overflow-hidden"
        style={{
          'border-color': focused() ? colorVar('tint') : colorVar('outline'),
          'min-height': `${height()}px`,
          height: `${height()}px`,
        }}
      >
        <HighlightMirror segments={segments()} style={layer()} />
        <EditorField {...field} style={layer()} onFocusChange={setFocused} />
      </div>
      <Show when={props.trailing}>{props.trailing}</Show>
    </div>
  );
}
