/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { Button } from '../button';
import { ExampleRoot } from '../explorer/example-root';
import { ConfirmationModal } from './confirmation-modal';

export default function ModalExample(): JSX.Element {
  const [defaultOpen, setDefaultOpen] = createSignal(false);
  const [destructiveOpen, setDestructiveOpen] = createSignal(false);

  return (
    <ExampleRoot>
      <div class="box flex-col gap-2">
        <Button
          title="Open Default Modal"
          onClick={() => setDefaultOpen(true)}
        />
        <Button
          title="Open Destructive Modal"
          intent="danger"
          onClick={() => setDestructiveOpen(true)}
        />
      </div>

      <ConfirmationModal
        visible={defaultOpen()}
        title="Confirm Action"
        message="Are you sure you want to proceed with this action?"
        onConfirm={() => {
          setDefaultOpen(false);
        }}
        onCancel={() => setDefaultOpen(false)}
      />

      <ConfirmationModal
        visible={destructiveOpen()}
        title="Delete Item?"
        message="This action cannot be undone. The item will be permanently removed."
        variant="destructive"
        confirmLabel="Delete"
        onConfirm={() => {
          setDestructiveOpen(false);
        }}
        onCancel={() => setDestructiveOpen(false)}
      />
    </ExampleRoot>
  );
}
