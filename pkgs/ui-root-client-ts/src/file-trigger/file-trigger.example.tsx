/** @jsxImportSource solid-js */

import { FileTrigger } from '@pkgs/ui-root-client-ts/file-trigger';
import { IconButton } from '@pkgs/ui-root-client-ts/icon-button';
import { PaperclipIcon } from '@pkgs/ui-root-client-ts/icons';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

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
