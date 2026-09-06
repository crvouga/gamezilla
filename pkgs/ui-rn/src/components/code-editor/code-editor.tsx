/**
 * `CodeEditor` — multiline monospace editor with overlay syntax highlighting.
 *
 * Transparent `TextInput` sits over a token-colored mirror so the caret and
 * selection stay native while highlighting is pure React text spans.
 */

import {
  forwardRef,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react';
import {
  Platform,
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps as RNTextInputProps,
} from 'react-native';
import { useHostSx, useTheme } from '../../theme';
import { Box } from '../box';
import {
  matchesWebShortcut,
  useDocumentShortcuts,
  type WebKeyboardEventLike,
} from '../keyboard-shortcuts';
import type {
  CodeEditorProps,
  CodeToken,
  CodeTokenKind,
} from './code-editor-types';

const LINE_HEIGHT = 20;
const PAD = 2.5;
const FONT_SIZE = 13;

export const CodeEditor = forwardRef<RNTextInput, CodeEditorProps>(
  function CodeEditor(props, ref) {
    const theme = useTheme();
    const [focused, setFocused] = useState(false);
    const tokens = useMemo(
      () => props.tokenize(props.value),
      [props.tokenize, props.value]
    );
    const lineCount = Math.max(props.minLines ?? 3, countLines(props.value));
    const height = lineCount * LINE_HEIGHT + 16;
    useEditorShortcuts({ focused, onKeyDown: props.onKeyDown });
    const field = useHostSx(
      'CodeEditorField',
      fieldSx(theme.fonts.mono, theme.colors.text)
    );

    return (
      <Box
        sx={[{ gap: 1 }, props.sx]}
        dataSet={{ component: 'CodeEditor', ...props.dataSet }}
      >
        <EditorFrame focused={focused} height={height}>
          <HighlightMirror
            value={props.value}
            tokens={tokens}
            mono={theme.fonts.mono}
            colors={theme.colors}
          />
          <RNTextInput
            ref={ref}
            multiline
            value={props.value}
            editable={props.editable !== false}
            autoFocus={props.autoFocus}
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            placeholder={props.placeholder}
            placeholderTextColor={theme.colors.textSecondary}
            accessibilityLabel={props.accessibilityLabel}
            textAlignVertical="top"
            onChangeText={props.onChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSelectionChange={makeSelectionHandler(props.onSelectionChange)}
            onKeyPress={makeKeyPressHandler(props.onKeyDown)}
            style={field.style}
            {...field.dataSet}
          />
        </EditorFrame>
        {props.trailing}
      </Box>
    );
  }
);

function EditorFrame(props: {
  readonly focused: boolean;
  readonly height: number;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: props.height,
        height: props.height,
        borderWidth: 1,
        borderColor: props.focused ? 'tint' : 'outline',
        borderRadius: 'md',
        backgroundColor: 'surfaceMuted',
        overflow: 'hidden',
      }}
    >
      {props.children}
    </Box>
  );
}

function fieldSx(mono: string, caret: string) {
  return {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    px: PAD,
    py: PAD,
    fontSize: FONT_SIZE,
    fontFamily: mono,
    lineHeight: LINE_HEIGHT,
    color: 'transparent',
    ...(Platform.OS === 'web'
      ? ({ caretColor: caret } as Record<string, string>)
      : {}),
  };
}

function countLines(value: string): number {
  let n = 1;
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) === 10) n += 1;
  }
  return n;
}

function useEditorShortcuts(args: {
  readonly focused: boolean;
  readonly onKeyDown: CodeEditorProps['onKeyDown'];
}): void {
  const { focused, onKeyDown } = args;
  const handle = useCallback(
    (ev: WebKeyboardEventLike) => {
      if (onKeyDown === undefined) return false;
      return onKeyDown(ev) === true;
    },
    [onKeyDown]
  );
  useDocumentShortcuts({
    enabled: focused && onKeyDown !== undefined,
    onKeyDown: handle,
  });
}

function makeSelectionHandler(
  onSelectionChange: CodeEditorProps['onSelectionChange']
): RNTextInputProps['onSelectionChange'] {
  if (onSelectionChange === undefined) return undefined;
  return (e) => {
    const { start, end } = e.nativeEvent.selection;
    onSelectionChange({ start, end });
  };
}

function makeKeyPressHandler(
  onKeyDown: CodeEditorProps['onKeyDown']
): RNTextInputProps['onKeyPress'] {
  if (onKeyDown === undefined) return undefined;
  return (e) => {
    const native = e.nativeEvent as {
      key: string;
      metaKey?: boolean;
      ctrlKey?: boolean;
      altKey?: boolean;
      shiftKey?: boolean;
    };
    const like: WebKeyboardEventLike = {
      key: native.key,
      metaKey: native.metaKey === true,
      ctrlKey: native.ctrlKey === true,
      altKey: native.altKey === true,
      shiftKey: native.shiftKey === true,
      repeat: false,
      preventDefault: () => undefined,
    };
    if (matchesWebShortcut('tab', like) || matchesWebShortcut('esc', like)) {
      onKeyDown(like);
    }
  };
}

type ThemeColors = ReturnType<typeof useTheme>['colors'];

function HighlightMirror(props: {
  readonly value: string;
  readonly tokens: readonly CodeToken[];
  readonly mono: string;
  readonly colors: ThemeColors;
}): ReactNode {
  const spans = useMemo(
    () => buildHighlightSpans(props.value, props.tokens, props.colors),
    [props.value, props.tokens, props.colors]
  );
  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        px: PAD,
        py: PAD,
        pointerEvents: 'none',
      }}
    >
      <RNText
        style={{
          fontFamily: props.mono,
          fontSize: FONT_SIZE,
          lineHeight: LINE_HEIGHT,
        }}
      >
        {spans}
      </RNText>
    </Box>
  );
}

function tokenColor(kind: CodeTokenKind, colors: ThemeColors): string {
  switch (kind) {
    case 'keyword':
      return colors.tint;
    case 'string':
      return colors.success;
    case 'number':
      return colors.info;
    case 'operator':
    case 'param':
      return colors.warning;
    case 'comment':
    case 'punctuation':
      return colors.textSecondary;
    default:
      return colors.text;
  }
}

function buildHighlightSpans(
  value: string,
  tokens: readonly CodeToken[],
  colors: ThemeColors
): ReactNode[] {
  if (value.length === 0) {
    return [
      <RNText key="empty" style={{ color: colors.textSecondary }}>
        {' '}
      </RNText>,
    ];
  }
  const out: ReactNode[] = [];
  let cursor = 0;
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    if (tok.start > cursor) {
      out.push(
        <RNText key={`p-${cursor}`} style={{ color: colors.text }}>
          {value.slice(cursor, tok.start)}
        </RNText>
      );
    }
    out.push(
      <RNText
        key={`t-${tok.start}-${tok.end}`}
        style={{ color: tokenColor(tok.kind, colors) }}
      >
        {value.slice(tok.start, tok.end)}
      </RNText>
    );
    cursor = tok.end;
  }
  if (cursor < value.length) {
    out.push(
      <RNText key={`tail-${cursor}`} style={{ color: colors.text }}>
        {value.slice(cursor)}
      </RNText>
    );
  }
  return out;
}
