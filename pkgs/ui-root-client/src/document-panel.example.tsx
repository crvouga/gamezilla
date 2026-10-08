import { DocumentPanel } from './document-panel';
import { ExampleRoot } from './example-root';

export default function DocumentPanelExample() {
  return (
    <ExampleRoot>
      <DocumentPanel
        title="Selected document"
        caption="Read-only source"
        content={
          'Feature: Find saved items\n\n  Scenario: A saved item is available\n    Then Alice sees her saved item'
        }
      />
    </ExampleRoot>
  );
}
