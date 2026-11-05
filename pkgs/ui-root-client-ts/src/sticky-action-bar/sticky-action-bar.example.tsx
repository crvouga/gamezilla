import type { JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { Button } from '../button/index';
import { StickyActionBar } from './index';

/** A builder's last step: an outline step, then the one filled next step. */
export default function StickyActionBarExample(): JSX.Element {
  return (
    <ExampleRoot>
      <StickyActionBar
        title="3 · Check and publish"
        description="Playtest it, check it, then share it with everyone who plays."
      >
        <Button title="Start playtest" intent="neutral" variant="outline" />
        <Button title="Validate" intent="primary" variant="solid" />
        <Button title="Publish" intent="neutral" variant="outline" />
      </StickyActionBar>
    </ExampleRoot>
  );
}
