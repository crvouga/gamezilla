/** @jsxImportSource solid-js */

import { MarkdownEditor } from '@pkgs/ui-root-client-ts/markdown-editor';
import { createSignal } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

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
