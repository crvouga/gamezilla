/** @jsxImportSource solid-js */
import { useLingui } from '@lingui/solid/macro';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { Stack } from '../stack';
import { Text } from '../text';
import { CodeEditor } from './code-editor';
import type { CodeToken, CodeTokenKind } from './code-editor-types';

const KEYWORDS = new Set(['select', 'from', 'where', 'and', 'or', 'limit']);
const TOKEN_RE = /(--[^\n]*)|('([^']|'')*')|\b[a-z_][\w]*\b|\d+|[^\s]/gi;

function classify(match: RegExpExecArray): CodeTokenKind {
  const text = match[0];
  if (match[1] !== undefined) return 'comment';
  if (match[2] !== undefined) return 'string';
  if (/^\d+$/.test(text)) return 'number';
  if (KEYWORDS.has(text.toLowerCase())) return 'keyword';
  if (/^[a-z_]/i.test(text)) return 'identifier';
  return 'punctuation';
}

function demoTokenize(src: string): readonly CodeToken[] {
  const out: CodeToken[] = [];
  const re = new RegExp(TOKEN_RE.source, TOKEN_RE.flags);
  let m = re.exec(src);
  while (m !== null) {
    const start = m.index;
    out.push({ kind: classify(m), start, end: start + m[0].length });
    m = re.exec(src);
  }
  return out;
}

const INITIAL = `-- demo\nSELECT id, name\nFROM users\nWHERE id = 1\nLIMIT 10;`;

export default function CodeEditorExample(): JSX.Element {
  const { t } = useLingui();
  const [value, setValue] = createSignal(INITIAL);
  return (
    <ExampleRoot>
      <SchemePreview>
        <Stack spacing={3}>
          <Text variant="label" label="SQL-ish editor" />
          <CodeEditor
            value={value()}
            onChangeText={setValue}
            tokenize={demoTokenize}
            minLines={5}
            aria-label={t`Demo code editor`}
          />
        </Stack>
      </SchemePreview>
    </ExampleRoot>
  );
}
