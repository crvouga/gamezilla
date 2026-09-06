/** @jsxImportSource solid-js */
import { Clickable, SurfaceStackProvider, Text } from '@pkgs/ui';
import { Button } from '@pkgs/ui/components/button';
import {
  ConfirmationModal,
  ModalBackdrop,
  ModalBody,
  ModalButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalRoot,
  type ModalSize,
} from '@pkgs/ui/components/modal';
import { fireEvent, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal, type JSX } from 'solid-js';
import { describe, expect, test, vi } from 'vitest';
import { cssOf, mustQuery, renderUi } from './support/render';

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
        <Clickable
          dataSet={{ testid: 'trigger' }}
          onClick={() => setOpen(true)}
        >
          <Text label="Open" />
        </Clickable>
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
    const onClose = vi.fn();
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
    const closeFirst = vi.fn();
    const closeSecond = vi.fn();
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
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
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
