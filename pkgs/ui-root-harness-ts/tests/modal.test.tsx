/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ConfirmationModal } from '@pkgs/ui-root-client-ts/confirmation-modal';
import { ModalBackdrop } from '@pkgs/ui-root-client-ts/modal-backdrop';
import { ModalContent } from '@pkgs/ui-root-client-ts/modal-content';
import {
  ModalBody,
  ModalButton,
  ModalFooter,
  ModalHeader,
} from '@pkgs/ui-root-client-ts/modal-parts';
import { ModalRoot } from '@pkgs/ui-root-client-ts/modal-root';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import type { ModalSize } from '@pkgs/ui-root-shared-ts/modal-size';
import { fireEvent, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal, type JSX } from 'solid-js';
import { cssOf, mustQuery, renderUi } from './render';

function Dialog(props: {
  visible: boolean;
  onRequestClose: () => void;
  title: string;
  size?: ModalSize;
  dismissOnBackdrop?: boolean;
  stackId?: string;
}): JSX.Element {
  return (
    <ModalRoot
      visible={props.visible}
      onRequestClose={props.onRequestClose}
      stackId={props.stackId}
    >
      <ModalBackdrop
        onClick={props.onRequestClose}
        dismissOnBackdrop={props.dismissOnBackdrop}
      >
        <ModalContent size={props.size}>
          <ModalHeader title={props.title} />
          <ModalBody message="Body copy" />
          <ModalFooter>
            <ModalButton label={`OK ${props.title}`} onClick={() => {}} />
          </ModalFooter>
        </ModalContent>
      </ModalBackdrop>
    </ModalRoot>
  );
}

describe('ModalRoot', () => {
  test('exposes a labelled dialog, moves focus in, and restores it on close', () => {
    const [open, setOpen] = createSignal(false);
    renderUi(() => (
      <SurfaceStackProvider>
        <button
          class="clickable clickableTint"
          data-testid="trigger"
          type="button"
          onClick={() => setOpen(true)}
        >
          <p class="text">{'Open'}</p>
        </button>
        <Dialog
          visible={open()}
          onRequestClose={() => setOpen(false)}
          title="Settings"
        />
      </SurfaceStackProvider>
    ));
    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'OK Settings' })).toHaveFocus();
    expect(
      dialog.closest('[data-component="SurfaceStackHost"]')
    ).not.toBeNull();

    setOpen(false);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  test('backdrop click dismisses unless dismissOnBackdrop is false', () => {
    const onClose = mock();
    const [dismiss, setDismiss] = createSignal(true);
    renderUi(() => (
      <SurfaceStackProvider>
        <Dialog
          visible
          onRequestClose={onClose}
          title="Scrim"
          dismissOnBackdrop={dismiss()}
        />
      </SurfaceStackProvider>
    ));
    fireEvent.click(mustQuery('[data-component="ModalScrim"]'));
    expect(onClose).toHaveBeenCalledTimes(1);
    // Clicking inside the content never dismisses.
    fireEvent.click(mustQuery('[data-component="ModalContent"]'));
    expect(onClose).toHaveBeenCalledTimes(1);
    setDismiss(false);
    fireEvent.click(mustQuery('[data-component="ModalScrim"]'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('Escape closes only the top surface', async () => {
    const user = userEvent.setup();
    const closeFirst = mock();
    const closeSecond = mock();
    const [second, setSecond] = createSignal(true);
    renderUi(() => (
      <SurfaceStackProvider>
        <Dialog
          visible
          onRequestClose={closeFirst}
          title="First"
          stackId="first"
        />
        <Dialog
          visible={second()}
          onRequestClose={closeSecond}
          title="Second"
          stackId="second"
        />
      </SurfaceStackProvider>
    ));
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'OK Second' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(closeSecond).toHaveBeenCalledTimes(1);
    expect(closeFirst).not.toHaveBeenCalled();

    setSecond(false);
    await user.keyboard('{Escape}');
    expect(closeFirst).toHaveBeenCalledTimes(1);
  });

  test('throws when a visible modal has no SurfaceStackProvider', () => {
    expect(() =>
      renderUi(() => <Dialog visible onRequestClose={() => {}} title="Lost" />)
    ).toThrow(/SurfaceStackProvider missing/);
  });
});

describe('ModalContent', () => {
  test('width comes only from size buckets, clamped to the layout', () => {
    renderUi(
      () => (
        <>
          <ModalContent size="small" dataSet={{ testid: 's' }} />
          <ModalContent dataSet={{ testid: 'm' }} />
          <ModalContent size="large" dataSet={{ testid: 'l' }} />
          <ModalContent size="fullWidth" dataSet={{ testid: 'f' }} />
        </>
      ),
      { width: 600, height: 500 }
    );
    expect(cssOf(screen.getByTestId('s'))).toContain('max-width:360px');
    expect(cssOf(screen.getByTestId('m'))).toContain('max-width:440px');
    // large (720) clamps to 600 - 2 * 16 margin.
    expect(cssOf(screen.getByTestId('l'))).toContain('max-width:568px');
    expect(cssOf(screen.getByTestId('f'))).toContain('max-width:568px');
    expect(cssOf(screen.getByTestId('m'))).toContain('max-height:468px');
    expect(screen.getByTestId('m')).toHaveAttribute('data-size', 'medium');
  });

  test('the dialog floats: raised fill, sheet radius, the float shadow, no hairline', () => {
    renderUi(() => <ModalContent dataSet={{ testid: 'm' }} />);
    const sheet = screen.getByTestId('m');
    expect(sheet.className).toMatch(/\bbg-surface-elevated\b/);
    expect(sheet.className).toMatch(/\brounded-sheet\b/);
    expect(sheet.className).toMatch(/\bshadow-float\b/);
    expect(sheet.className).not.toMatch(/\bborder\b/);
    expect(sheet.className).toMatch(/\bdialogEnter\b/);
    expect(sheet.className).toMatch(/\bp-5\b/);
  });

  test('footer stacks full width on compact and is one row on wide', () => {
    const footer = (): JSX.Element => (
      <ModalFooter dataSet={{ testid: 'footer' }}>
        <ModalButton label="Go" onClick={() => {}} />
        <ModalButton label="Nah" variant="cancel" onClick={() => {}} />
      </ModalFooter>
    );
    const compact = renderUi(footer, { width: 400, height: 800 });
    expect(screen.getByTestId('footer').className).toMatch(/\bflex-col\b/);
    expect(screen.getByTestId('footer').className).toMatch(/\bitems-stretch\b/);
    compact.unmount();
    renderUi(footer, { width: 1200, height: 800 });
    // Primary first in tab order, drawn rightmost.
    expect(screen.getByTestId('footer').className).toMatch(
      /\bflex-row-reverse\b/
    );
    const names = screen.getAllByRole('button').map((b) => b.textContent);
    expect(names).toEqual(['Go', 'Nah']);
  });

  test('ModalButton maps variants onto Button intents', () => {
    renderUi(() => (
      <ModalFooter>
        <ModalButton label="Go" onClick={() => {}} />
        <ModalButton label="Nuke" variant="destructive" onClick={() => {}} />
        <ModalButton label="Nah" variant="cancel" onClick={() => {}} />
        <Button title="ref" />
      </ModalFooter>
    ));
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute(
      'data-intent',
      'primary'
    );
    expect(screen.getByRole('button', { name: 'Nuke' })).toHaveAttribute(
      'data-intent',
      'danger'
    );
    const cancel = screen.getByRole('button', { name: 'Nah' });
    expect(cancel).toHaveAttribute('data-intent', 'neutral');
    expect(cancel).toHaveAttribute('data-variant', 'ghost');
  });
});

describe('ConfirmationModal', () => {
  test('confirm / cancel wiring, submitting lock, and error caption', async () => {
    const user = userEvent.setup();
    const onConfirm = mock();
    const onCancel = mock();
    const [submitting, setSubmitting] = createSignal(false);
    const [error, setError] = createSignal<string | undefined>(undefined);
    renderUi(() => (
      <SurfaceStackProvider>
        <ConfirmationModal
          visible
          title="Delete item?"
          message="This action cannot be undone."
          variant="destructive"
          confirmLabel="Delete"
          submitting={submitting()}
          confirmError={error()}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      </SurfaceStackProvider>
    ));
    expect(
      screen.getByRole('dialog', { name: 'Delete item?' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('This action cannot be undone.')
    ).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: 'Delete' });
    expect(confirm).toHaveAttribute('data-intent', 'danger');
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    setSubmitting(true);
    expect(confirm).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    // Escape is swallowed while submitting.
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(1);

    setSubmitting(false);
    setError('Still in use');
    expect(screen.getByText('Still in use')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
