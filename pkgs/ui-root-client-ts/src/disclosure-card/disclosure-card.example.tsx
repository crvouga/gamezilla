import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { StackVertical } from '../stack/index';
import { TextInput } from '../text-input/index';
import { DisclosureCard } from './index';

/** A draft's details, closed to one row over the editor they describe. */
export default function DisclosureCardExample(props: {
  defaultOpen?: boolean;
}): JSX.Element {
  return (
    <ExampleRoot>
      <DisclosureCard
        title="1 · Details"
        summary="Two crates · Easy"
        defaultOpen={props.defaultOpen}
      >
        <StackVertical gap="md">
          <TextInput
            label="Title"
            value="Two crates"
            onChangeText={() => undefined}
          />
          <TextInput
            label="Difficulty (optional)"
            value="Easy"
            onChangeText={() => undefined}
          />
        </StackVertical>
      </DisclosureCard>
    </ExampleRoot>
  );
}
