import { DocumentPanel } from '@pkgs/ui-root-client-ts/document-panel';
import { InspectionWorkspace } from '@pkgs/ui-root-client-ts/inspection-workspace';
import { createSignal } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

export default function InspectionWorkspaceExample() {
  const [selected, setSelected] = createSignal('primary');
  return (
    <ExampleRoot>
      <div class="box h-80">
        <InspectionWorkspace
          primaryLabel="Preview"
          toolsLabel="Inspect"
          selected={selected()}
          onSelect={setSelected}
          primary={
            <DocumentPanel title="Preview" content="The selected document" />
          }
          tools={[
            {
              key: 'details',
              label: 'Details',
              content: (
                <DocumentPanel title="Details" content="Document properties" />
              ),
            },
            {
              key: 'history',
              label: 'History',
              content: (
                <DocumentPanel title="History" content="Recorded changes" />
              ),
            },
          ]}
        />
      </div>
    </ExampleRoot>
  );
}
