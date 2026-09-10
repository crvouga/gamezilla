/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { Collapsible } from './collapsible';

export default function CollapsibleExample(): JSX.Element {
  return (
    <ExampleRoot class="gap-2">
      <Collapsible title="Default (closed)">
        <p class="text">
          {
            'This content is hidden by default and revealed when the header is clicked.'
          }
        </p>
      </Collapsible>

      <Collapsible title="Starts open" defaultOpen>
        <p class="text">{'This section starts in the expanded state.'}</p>
      </Collapsible>

      <Collapsible title="Multiple items">
        <div class="box gap-2">
          <p class="text">{'Item 1'}</p>
          <p class="text">{'Item 2'}</p>
          <p class="text">{'Item 3'}</p>
        </div>
      </Collapsible>

      <Collapsible
        title="Custom icon"
        renderIcon={(isOpen) => <p class="text">{isOpen ? '▼' : '▶'}</p>}
      >
        <p class="text">{'Custom chevron icons via renderIcon prop.'}</p>
      </Collapsible>
    </ExampleRoot>
  );
}
