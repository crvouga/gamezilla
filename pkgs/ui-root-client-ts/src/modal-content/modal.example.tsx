/** @jsxImportSource @solidjs/web */

import { Button } from '@pkgs/ui-root-client-ts/button';
import { ConfirmationModal } from '@pkgs/ui-root-client-ts/confirmation-modal';
import { ModalContent } from '@pkgs/ui-root-client-ts/modal-content';
import {
  ModalBody,
  ModalButton,
  ModalFooter,
  ModalHeader,
} from '@pkgs/ui-root-client-ts/modal-parts';
import { ResponsiveSurface } from '@pkgs/ui-root-client-ts/responsive-surface';
import type { JSX } from '@solidjs/web';
import { createSignal } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

const noop = (): void => undefined;

/** The dialog drawn in place, so both schemes show its anatomy. */
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

type OpenModal =
  | 'options'
  | 'dialog'
  | 'default'
  | 'destructive'
  | 'submitting'
  | 'error';

export default function ModalExample(): JSX.Element {
  const [open, setOpen] = createSignal<OpenModal | null>(null);
  const close = (): void => {
    setOpen(null);
  };

  return (
    <ExampleRoot>
      <p class="text textCaption">
        {
          'Every modal is centered on the screen, vertically and horizontally, at every width: raised fill, 20px radius, float shadow. On phones it takes the whole width inside a 16px margin; long content scrolls inside it. It sits on the scrim, traps focus, returns it to the opener, and closes on Escape or a scrim tap.'
        }
      </p>
      <p class="text textSectionLabel">{'Dialog, open'}</p>
      <p class="text textCaption">
        {
          'Footer actions stack full width on compact layouts and sit in one right-aligned row on wide ones, primary on the right.'
        }
      </p>
      <DialogAnatomy />
      <p class="text textSectionLabel">{'Try them'}</p>
      <div class="box flex-col gap-2">
        <Button title="Open options" onClick={() => setOpen('options')} />
        <Button
          title="Open dialog"
          intent="neutral"
          onClick={() => setOpen('dialog')}
        />
        <Button title="Open confirmation" onClick={() => setOpen('default')} />
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

      <ResponsiveSurface
        visible={open() === 'options'}
        onClose={close}
        title="Game options"
      >
        <div class="box gap-4">
          <p class="text textBody text-text-secondary">
            {'Pick a time control. You can change it before the game starts.'}
          </p>
          <Button title="Start game" onClick={close} fullWidth />
        </div>
      </ResponsiveSurface>
      <ResponsiveSurface
        visible={open() === 'dialog'}
        onClose={close}
        title="Rematch?"
        presentation="modal"
        size="small"
      >
        <ModalBody message="Your opponent gets the first move this time." />
        <ModalFooter>
          <ModalButton label="Play again" onClick={close} />
          <ModalButton label="Not now" variant="cancel" onClick={close} />
        </ModalFooter>
      </ResponsiveSurface>
      <ConfirmationModal
        visible={open() === 'default'}
        title="Leave this space?"
        message="You can join again later while the space is live."
        confirmLabel="Leave"
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
        confirmError="Couldn't remove them. Check your connection and try again."
        onConfirm={close}
        onCancel={close}
      />
    </ExampleRoot>
  );
}
