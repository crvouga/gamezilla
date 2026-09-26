/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { SurfaceStackProvider } from '@pkgs/ui';
import {
  MutationModal,
  type MutationStateTransition,
  resolveMutationSurfaceClose,
  useMutationLifecycle,
} from '@pkgs/ui/components/mutation-modal';
import { fireEvent, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { mustQuery, renderUi } from './support/render';

function mount(args: {
  operation: () => Promise<void>;
  onClose?: () => void;
  onSuccess?: () => void;
  onPhaseChange?: (t: MutationStateTransition) => void;
}) {
  return renderUi(() => (
    <SurfaceStackProvider>
      <MutationModal
        visible
        onClose={args.onClose ?? (() => {})}
        onSuccess={args.onSuccess}
        onPhaseChange={args.onPhaseChange}
        title="End space?"
        message="Everyone will leave."
        submitLabel="End space"
        variant="destructive"
        operation={args.operation}
        loadingLabel="Ending…"
        successTitle="Space ended"
        successBody="Everyone is out."
        submitDataSet={{ testid: 'submit' }}
        successDataSet={{ testid: 'success' }}
        dismissDataSet={{ testid: 'dismiss' }}
      />
    </SurfaceStackProvider>
  ));
}

describe('MutationModal', () => {
  test('idle → loading → success; Done dismisses and fires onSuccess', async () => {
    const user = userEvent.setup();
    const onClose = mock();
    const onSuccess = mock();
    const phases: string[] = [];
    // Resolves on the injected sim timers so the phase flip is clock-driven.
    const r = mount({
      operation: () =>
        new Promise<void>((resolve) => {
          r.timers.setTimeout(resolve, 500);
        }),
      onClose,
      onSuccess,
      onPhaseChange: (t) => phases.push(t.to),
    });
    expect(
      screen.getByRole('dialog', { name: 'End space?' })
    ).toBeInTheDocument();
    const phaseBand = mustQuery('[data-component="MutationStateTransition"]');
    expect(phaseBand).toHaveAttribute('data-phase', 'idle');
    expect(screen.getByText('Everyone will leave.')).toBeInTheDocument();
    const submit = screen.getByTestId('submit');
    expect(submit).toHaveAttribute('data-intent', 'danger');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

    fireEvent.click(submit);
    expect(await screen.findByText('Ending…')).toBeInTheDocument();
    expect(phaseBand).toHaveAttribute('data-phase', 'loading');
    // Surface close is hidden while loading; Escape / backdrop stay inert.
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();

    r.clock.advance(499);
    expect(screen.getByText('Ending…')).toBeInTheDocument();
    r.clock.advance(1);
    const success = await screen.findByTestId('success');
    expect(success).toHaveAttribute('role', 'status');
    expect(success).toHaveTextContent('Space ended');
    expect(success).toHaveTextContent('Everyone is out.');
    expect(phaseBand).toHaveAttribute('data-phase', 'success');

    fireEvent.click(screen.getByTestId('dismiss'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(phases).toEqual(['loading', 'success']);
  });

  test('error phase is retryable and cancel closes', async () => {
    const onClose = mock();
    const onError = mock();
    const operation = mock<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('room is locked'))
      .mockResolvedValueOnce(undefined);
    renderUi(() => (
      <SurfaceStackProvider>
        <MutationModal
          visible
          onClose={onClose}
          onError={onError}
          title="Rename"
          message="Pick a new name"
          submitLabel="Save"
          operation={operation}
          successTitle="Renamed"
          errorTitle="Could not rename"
          retryLabel="Retry now"
        />
      </SurfaceStackProvider>
    ));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Could not rename');
    expect(alert).toHaveTextContent('room is locked');
    expect(onError).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Retry now' }));
    expect(operation).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Renamed')).toBeInTheDocument();
  });

  test('custom children replace the message in the idle body', () => {
    renderUi(() => (
      <SurfaceStackProvider>
        <MutationModal
          visible
          onClose={() => {}}
          title="Form"
          message="ignored"
          submitLabel="Save"
          submitDisabled
          operation={() => Promise.resolve()}
          successTitle="Saved"
        >
          <span data-testid="field">field</span>
        </MutationModal>
      </SurfaceStackProvider>
    ));
    expect(screen.getByTestId('field')).toBeInTheDocument();
    expect(screen.queryByText('ignored')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  test('re-exports the shared lifecycle and resolves surface close per phase', () => {
    expect(typeof useMutationLifecycle).toBe('function');
    const onClose = mock();
    const dismissSuccess = mock();
    resolveMutationSurfaceClose({ phase: 'loading', onClose, dismissSuccess });
    expect(onClose).not.toHaveBeenCalled();
    resolveMutationSurfaceClose({ phase: 'success', onClose, dismissSuccess });
    expect(dismissSuccess).toHaveBeenCalledTimes(1);
    resolveMutationSurfaceClose({ phase: 'error', onClose, dismissSuccess });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
