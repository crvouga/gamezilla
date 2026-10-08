import { createSignal } from 'solid-js';
import { DocumentPanel } from './document-panel';
import { ExampleRoot } from './example-root';
import { InspectionWorkspace } from './inspection-workspace';

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
