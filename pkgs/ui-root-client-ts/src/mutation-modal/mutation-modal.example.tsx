/** @jsxImportSource solid-js */
import { useLingui } from '@lingui/solid/macro';
import { useTimers } from '@pkgs/clock-client-ts/solid';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';

function createDelay(): (ms: number) => Promise<void> {
  const timers = useTimers();
  return (ms) =>
    new Promise<void>((resolve) => {
      timers.setTimeout(resolve, ms);
    });
}

function ConfirmExample(): JSX.Element {
  const [open, setOpen] = createSignal(false);
  const delay = createDelay();
  const endSpace = (): Promise<void> => delay(900);
  return (
    <>
      <Button
        title="Open confirm (succeeds)"
        intent="danger"
        onClick={() => setOpen(true)}
      />
      <MutationModal
        visible={open()}
        onClose={() => setOpen(false)}
        title="End space?"
        message="Everyone will leave this space. This cannot be undone."
        submitLabel="End space"
        variant="destructive"
        operation={endSpace}
        loadingLabel="Ending space…"
        successTitle="Space ended"
        successBody="Everyone has been returned to the lobby."
      />
    </>
  );
}

function ErrorExample(): JSX.Element {
  const [open, setOpen] = createSignal(false);
  const delay = createDelay();
  const leaveSpace = async (): Promise<void> => {
    await delay(900);
    throw new Error('Network unreachable — please retry.');
  };
  return (
    <>
      <Button title="Open confirm (fails)" onClick={() => setOpen(true)} />
      <MutationModal
        visible={open()}
        onClose={() => setOpen(false)}
        title="Leave space?"
        message="You can join again later if the space is still live."
        submitLabel="Leave"
        operation={leaveSpace}
        loadingLabel="Leaving…"
        successTitle="You left the space"
      />
    </>
  );
}

function FormExample(): JSX.Element {
  const { t } = useLingui();
  const [open, setOpen] = createSignal(false);
  const [value, setValue] = createSignal('');
  const delay = createDelay();
  const rename = (): Promise<void> => delay(700);
  return (
    <>
      <Button title="Open form mutation" onClick={() => setOpen(true)} />
      <MutationModal
        visible={open()}
        onClose={() => setOpen(false)}
        title="Rename space"
        submitLabel="Save"
        submitDisabled={value().trim().length === 0}
        operation={rename}
        loadingLabel="Saving…"
        successTitle="Renamed"
      >
        <TextInput
          label={t`Space name`}
          value={value()}
          onChangeText={setValue}
          placeholder={t`Give your space a name`}
          autofocus
        />
      </MutationModal>
    </>
  );
}

export default function MutationModalExample(): JSX.Element {
  return (
    <ExampleRoot>
      <p class="text textCaption text-text-secondary">
        {
          'Submit transitions through loading -> success / error in place. Success is dismissible; errors are retryable.'
        }
      </p>
      <div class="box flex-col gap-2">
        <ConfirmExample />
        <ErrorExample />
        <FormExample />
      </div>
    </ExampleRoot>
  );
}

/** A real open dialog; only the operation outcome is simulated by the fixture. */
export function MutationModalStateExample(props: {
  outcome: 'success' | 'retry';
  onOperation: (attempt: number) => void;
  onClose: () => void;
}): JSX.Element {
  const [open, setOpen] = createSignal(true);
  const delay = createDelay();
  let attempt = 0;
  const operation = async (): Promise<void> => {
    attempt += 1;
    props.onOperation(attempt);
    const shouldFail = props.outcome === 'retry' && attempt === 1;
    await delay(900);
    if (shouldFail) throw new Error('Connection interrupted. Try again.');
  };
  return (
    <ExampleRoot bounded>
      <Button title="Open confirmation" onClick={() => setOpen(true)} />
      <MutationModal
        visible={open()}
        onClose={() => {
          props.onClose();
          setOpen(false);
        }}
        title="End space?"
        message="Everyone will leave this space. This cannot be undone."
        submitLabel="End space"
        variant="destructive"
        operation={operation}
        loadingLabel="Ending space…"
        successTitle="Space ended"
        successBody="Everyone has been returned to the lobby."
        errorTitle="Could not end the space"
      />
    </ExampleRoot>
  );
}
