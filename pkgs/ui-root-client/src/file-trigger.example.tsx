/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from './example-root';
import { ExampleSection } from './example-section';
import { FileTrigger } from './file-trigger';
import { IconButton } from './icon-button';
import { PaperclipIcon } from './icons';
import { StackHorizontal } from './stack';
import { P } from './text';

export default function FileTriggerExample(): JSX.Element {
  const [name, setName] = createSignal('');
  return (
    <ExampleRoot>
      <ExampleSection title="An icon button that opens the file chooser">
        <StackHorizontal align="center" gap="sm">
          <FileTrigger
            label="Attach a screenshot"
            accept="image/*"
            onSelect={(file) => setName(file.name)}
          >
            {(open) => (
              <IconButton label="Attach screenshot" onClick={open}>
                <PaperclipIcon size={18} />
              </IconButton>
            )}
          </FileTrigger>
          <P variant="caption">{name() || 'No file chosen'}</P>
        </StackHorizontal>
      </ExampleSection>
    </ExampleRoot>
  );
}
