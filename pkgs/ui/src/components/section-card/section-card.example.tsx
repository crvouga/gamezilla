/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { Text } from '../text';
import { SectionCard } from './section-card';

export default function SectionCardExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SectionCard title="Details" defaultOpen={false}>
        <Text
          variant="body"
          label="Hidden until expanded — same Collapsible behavior as before."
        />
      </SectionCard>
    </ExampleRoot>
  );
}
