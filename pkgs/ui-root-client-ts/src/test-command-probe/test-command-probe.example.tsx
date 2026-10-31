/** @jsxImportSource solid-js */

import { TestCommandProbe } from '@pkgs/ui-root-client-ts/test-command-probe';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { ExampleSection } from '../../storybook/fixtures/example-section';

export default function TestCommandProbeExample(): JSX.Element {
  const [command, setCommand] = createSignal('{"operation":"ping"}');
  const [sent, setSent] = createSignal<readonly string[]>([]);
  return (
    <ExampleRoot>
      <ExampleSection title="Hidden: only a test or a screen reader reaches it">
        <P variant="caption" tone="secondary">
          Commands sent so far: {sent().length}
        </P>
        <TestCommandProbe
          commandLabel="Example command"
          sendLabel="Send example command"
          command={command()}
          onCommandInput={setCommand}
          onSend={() => setSent((all) => [...all, command()])}
          readout={JSON.stringify({ sent: sent() })}
          commandTestId="example-probe-command"
          sendTestId="example-probe-send"
          readoutTestId="example-probe-readout"
        />
      </ExampleSection>
    </ExampleRoot>
  );
}
