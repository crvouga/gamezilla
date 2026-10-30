import {
  DirectionPad,
  type DirectionPadProps,
} from '@pkgs/ui-root-client-ts/direction-pad';
import type { JSX } from 'solid-js';
import { fn } from 'storybook/test';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

export const DIRECTION_LABELS = {
  up: 'Steer up',
  right: 'Steer right',
  down: 'Steer down',
  left: 'Steer left',
};

export default function DirectionPadExample(): JSX.Element {
  const onDirection =
    fn<DirectionPadProps['onDirection']>().mockName('onDirection');
  return (
    <ExampleRoot>
      <ExampleSection title="Enabled: steers on touch, before the finger lifts">
        <DirectionPad
          labels={DIRECTION_LABELS}
          disabled={false}
          testId="direction-pad-example"
          onDirection={onDirection}
        />
      </ExampleSection>
      <ExampleSection title="Disabled: between rounds or while watching">
        <DirectionPad
          labels={DIRECTION_LABELS}
          disabled={true}
          testId="direction-pad-example-disabled"
          onDirection={onDirection}
        />
      </ExampleSection>
    </ExampleRoot>
  );
}
