import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { Button } from '../button/index';
import { StackHorizontal } from '../stack/index';
import { P } from '../text/index';
import { StepFooter } from './index';

/** A builder's last step: where it stands, an outline step, then the filled one. */
export default function StepFooterExample(): JSX.Element {
  return (
    <ExampleRoot>
      <StepFooter title="3 · Check and publish">
        <StackHorizontal gap="sm" wrap align="center" justify="between">
          <P variant="caption" tone="secondary">
            Not proven yet: finish a playtest, then validate.
          </P>
          <StackHorizontal gap="sm" wrap>
            <Button title="Start playtest" intent="neutral" variant="outline" />
            <Button title="Validate" intent="primary" variant="solid" />
            <Button title="Publish" intent="neutral" variant="outline" />
          </StackHorizontal>
        </StackHorizontal>
      </StepFooter>
    </ExampleRoot>
  );
}
