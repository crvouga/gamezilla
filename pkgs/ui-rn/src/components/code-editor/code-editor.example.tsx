import { useState } from 'react';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { Stack } from '../stack';
import { Text } from '../text';
import { CodeEditor } from './code-editor';
import type { CodeToken } from './code-editor-types';

const KEYWORDS = new Set(['select', 'from', 'where', 'and', 'or', 'limit']);

function demoTokenize(src: string): readonly CodeToken[] {
  const out: CodeToken[] = [];
  const re = /(--[^\n]*)|('([^']|'')*')|\b[a-z_][\w]*\b|\d+|[^\s]/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const text = m[0]!;
    const start = m.index;
    const end = start + text.length;
    if (m[1] !== undefined) {
      out.push({ kind: 'comment', start, end });
    } else if (m[2] !== undefined) {
      out.push({ kind: 'string', start, end });
    } else if (/^\d+$/.test(text)) {
      out.push({ kind: 'number', start, end });
    } else if (KEYWORDS.has(text.toLowerCase())) {
      out.push({ kind: 'keyword', start, end });
    } else if (/^[a-z_]/i.test(text)) {
      out.push({ kind: 'identifier', start, end });
    } else {
      out.push({ kind: 'punctuation', start, end });
    }
  }
  return out;
}

export default function CodeEditorExample() {
  const [value, setValue] = useState(
    `-- demo\nSELECT id, name\nFROM users\nWHERE id = 1\nLIMIT 10;`
  );
  return (
    <ExampleRoot>
      <SchemePreview>
        <Stack spacing={3}>
          <Text variant="label" label="SQL-ish editor" />
          <CodeEditor
            value={value}
            onChangeText={setValue}
            tokenize={demoTokenize}
            minLines={5}
            accessibilityLabel="Demo code editor"
          />
        </Stack>
      </SchemePreview>
    </ExampleRoot>
  );
}
