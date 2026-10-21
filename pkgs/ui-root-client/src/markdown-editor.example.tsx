/** @jsxImportSource solid-js */
import { createSignal } from 'solid-js';
import { ExampleRoot } from './example-root';
import { MarkdownEditor } from './markdown-editor';
import { SchemePreview } from './scheme-preview';

export default function MarkdownEditorExample() {
  const [value, setValue] = createSignal(
    '## A shared plan\n\nWrite **freely**, then type / for an outline.'
  );
  return (
    <ExampleRoot>
      <SchemePreview>
        <div class="box h-96 rounded-card border border-border overflow-hidden">
          <MarkdownEditor
            value={value()}
            onChange={setValue}
            aria-label="Plan"
            commands={[
              {
                id: 'outline',
                label: 'Outline',
                description: 'Start with an outline',
                body: '## Goal\n\n## Next steps',
              },
            ]}
          />
        </div>
      </SchemePreview>
    </ExampleRoot>
  );
}
