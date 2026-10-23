/** @jsxImportSource solid-js */
import { createSignal, type JSX } from 'solid-js';
import { Button } from './button';
import { ConfirmationModal } from './confirmation-modal';
import { ExampleRoot } from './example-root';
import { ModalContent } from './modal-content';
import {
  ModalBody,
  ModalButton,
  ModalFooter,
  ModalHeader,
} from './modal-parts';
import { SchemePreview } from './scheme-preview';

const noop = (): void => undefined;

/** The dialog sheet drawn in place, so both schemes show its anatomy. */
function DialogAnatomy(): JSX.Element {
  return (
    <SchemePreview>
      <div class="box gap-4 p-4 bg-scrim rounded-card">
        <ModalContent size="small">
          <ModalHeader title="Leave space?" />
          <ModalBody message="You can join again later if the space is still live." />
          <ModalFooter>
            <ModalButton label="Leave" onClick={noop} />
            <ModalButton label="Cancel" variant="cancel" onClick={noop} />
          </ModalFooter>
        </ModalContent>
        <ModalContent size="small">
          <ModalHeader title="Delete puzzle set?" />
          <ModalBody message="This cannot be undone." />
          <ModalFooter>
            <ModalButton label="Delete" variant="destructive" onClick={noop} />
            <ModalButton
              label="Cancel"
              variant="cancel"
              onClick={noop}
              disabled
            />
          </ModalFooter>
        </ModalContent>
      </div>
    </SchemePreview>
  );
}

type OpenModal = 'default' | 'destructive' | 'submitting' | 'error';

export default function ModalExample(): JSX.Element {
  const [open, setOpen] = createSignal<OpenModal | null>(null);
  const close = (): void => {
    setOpen(null);
  };

  return (
    <ExampleRoot>
      <p class="text textCaption">
        {
          'Footer actions stack full width on compact layouts and sit in one right-aligned row on wide ones, primary on the right.'
        }
      </p>
      <DialogAnatomy />
      <div class="box flex-col gap-2">
        <Button title="Open default" onClick={() => setOpen('default')} />
        <Button
          title="Open destructive"
          intent="danger"
          onClick={() => setOpen('destructive')}
        />
        <Button
          title="Open submitting"
          intent="neutral"
          onClick={() => setOpen('submitting')}
        />
        <Button
          title="Open with error"
          intent="neutral"
          onClick={() => setOpen('error')}
        />
      </div>

      <ConfirmationModal
        visible={open() === 'default'}
        title="Confirm action"
        message="Are you sure you want to proceed with this action?"
        onConfirm={close}
        onCancel={close}
      />
      <ConfirmationModal
        visible={open() === 'destructive'}
        title="Delete item?"
        message="This action cannot be undone. The item will be permanently removed."
        variant="destructive"
        confirmLabel="Delete"
        onConfirm={close}
        onCancel={close}
      />
      <ConfirmationModal
        visible={open() === 'submitting'}
        title="Saving"
        message="Both actions wait while the request is in flight."
        submitting
        onConfirm={close}
        onCancel={close}
      />
      <ConfirmationModal
        visible={open() === 'error'}
        title="Remove friend?"
        message="They will not be told."
        variant="destructive"
        confirmLabel="Remove"
        confirmError="Could not remove. Check your connection and try again."
        onConfirm={close}
        onCancel={close}
      />
    </ExampleRoot>
  );
}
