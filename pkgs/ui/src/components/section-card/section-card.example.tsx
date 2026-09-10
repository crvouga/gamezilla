/** @jsxImportSource solid-js */
import type { JSX } from 'solid-js';
import { ExampleRoot } from '../explorer/example-root';
import { SectionCard } from './section-card';

export default function SectionCardExample(): JSX.Element {
  return (
    <ExampleRoot>
      <SectionCard title="Details" defaultOpen={false}>
        <p class="text">
          {'Hidden until expanded — same Collapsible behavior as before.'}
        </p>
      </SectionCard>
    </ExampleRoot>
  );
}
