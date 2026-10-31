/** @jsxImportSource solid-js */

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
import { ResponsiveSurfaceHeader } from '@pkgs/ui-root-client-ts/responsive-surface-header';
import { BottomSheetPanel } from '@pkgs/ui-root-client-ts/web-bottom-sheet';
import { createSignal, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

const noop = (): void => undefined;

/** Height of the in-place phone frame the sheet anatomy is drawn in (px). */
const SHEET_FRAME_MAX_HEIGHT = 432;

/** An open bottom sheet drawn in place over a page, in both schemes. */
function SheetAnatomy(): JSX.Element {
  return (
    <SchemePreview>
      <div class="box relative h-120 w-full max-w-96 overflow-hidden rounded-card bg-background">
        <div class="box gap-2 p-4">
          <p class="text textHeading">{'Friday chess'}</p>
          <p class="text textBody text-text-secondary">
            {'The page behind the sheet, dimmed by the scrim.'}
          </p>
        </div>
        <div class="box absolute inset-0 bg-scrim" aria-hidden="true" />
        <BottomSheetPanel maxHeight={SHEET_FRAME_MAX_HEIGHT}>
          <div class="box gap-3 px-4 pt-4 pb-6">
            <ResponsiveSurfaceHeader title="Game options" onClose={noop} />
            <p class="text textBody text-text-secondary">
              {'Pick a time control. You can change it before the game starts.'}
            </p>
            <Button title="Start game" onClick={noop} fullWidth />
          </div>
        </BottomSheetPanel>
      </div>
    </SchemePreview>
  );
}

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
  | 'sheet'
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
          'Sheet: a bottom sheet on phones (raised fill, 20px top radius, grab handle, float shadow, safe-area inset) and a centered dialog on wide layouts. Dialog: always centered, 20px radius. Both sit on the scrim, trap focus, return it to the opener, and close on Escape or a scrim tap.'
        }
      </p>
      <p class="text textSectionLabel">{'Sheet, open'}</p>
      <SheetAnatomy />
      <p class="text textSectionLabel">{'Dialog, open'}</p>
      <p class="text textCaption">
        {
          'Footer actions stack full width on compact layouts and sit in one right-aligned row on wide ones, primary on the right.'
        }
      </p>
      <DialogAnatomy />
      <p class="text textSectionLabel">{'Try them'}</p>
      <div class="box flex-col gap-2">
        <Button title="Open sheet" onClick={() => setOpen('sheet')} />
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
        visible={open() === 'sheet'}
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
