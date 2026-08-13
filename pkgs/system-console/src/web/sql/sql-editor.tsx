import Editor, { loader } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useEffect, useRef } from 'react';

import { t } from '../theme-tokens';
import { sqlPanelStyles as s } from './sql-panel-styles';

// CDN workers — Bun.build does not emit Monaco worker chunks.
loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.56.0/min/vs',
  },
});

export function SqlEditor(props: {
  readonly value: string;
  readonly onChange: (next: string) => void;
  readonly onRun: () => void;
  readonly disabled?: boolean;
}) {
  const onRunRef = useRef(props.onRun);
  onRunRef.current = props.onRun;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!props.disabled) onRunRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.disabled]);

  return (
    <div style={s.editorWrap}>
      <Editor
        height="100%"
        defaultLanguage="sql"
        theme="vs-dark"
        value={props.value}
        onChange={(v) => props.onChange(v ?? '')}
        options={editorOptions}
        loading={<div style={s.muted}>Loading editor…</div>}
      />
    </div>
  );
}

const editorOptions: editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: false },
  fontSize: 12,
  fontFamily: t.mono,
  lineNumbers: 'on',
  scrollBeyondLastLine: false,
  wordWrap: 'on',
  automaticLayout: true,
  tabSize: 2,
  renderLineHighlight: 'line',
  padding: { top: 8, bottom: 8 },
};
