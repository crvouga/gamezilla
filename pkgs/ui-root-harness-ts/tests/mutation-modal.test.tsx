/** @jsxImportSource @solidjs/web */

import { describe, expect, mock, test } from 'bun:test';
import type { MutationStateTransition } from '@pkgs/ui-root-client-ts/mutation-lifecycle';
import { useMutationLifecycle } from '@pkgs/ui-root-client-ts/mutation-lifecycle';
import {
  MutationModal,
  resolveMutationSurfaceClose,
} from '@pkgs/ui-root-client-ts/mutation-modal';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { fireEvent, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { mustQuery, renderUi } from './render';

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
    // Resolves on the injected harness timers so the phase flip is clock-driven.
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
    expect(submit).toHaveAttribute('data-agent-confirm', 'End space');
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();

    fireEvent.click(submit);
    expect(await screen.findByText('Ending…')).toBeInTheDocument();
    expect(phaseBand).toHaveAttribute('data-phase', 'loading');
    // regression: mutation-modal-traps-unconfirmed-command
    // Closing dismisses the observation, without cancelling a saved request.
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(
      screen.getAllByRole('button', { name: 'Close' }).length
    ).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();

    r.clock.advance(499);
    expect(screen.getByText('Ending…')).toBeInTheDocument();
    r.clock.advance(1);
    const success = await screen.findByTestId('success');
    expect(success).toHaveAttribute('role', 'status');
    // Done, the surface is titled with the outcome, not the question.
    expect(
      screen.getByRole('dialog', { name: 'Space ended' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'End space?' })).toBeNull();
    expect(success).toHaveTextContent('Everyone is out.');
    expect(phaseBand).toHaveAttribute('data-phase', 'success');

    fireEvent.click(screen.getByTestId('dismiss'));
    expect(onClose).toHaveBeenCalledTimes(2);
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

    const retry = screen.getByRole('button', { name: 'Retry now' });
    expect(retry).toHaveAttribute('data-agent-confirm', 'Save');
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toHaveAttribute(
      'data-agent-confirm'
    );
    fireEvent.click(retry);
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

  // regression: r66 rename-at-confirm-width — a form took a confirmation's
  // inset on a phone, squeezing its field; only a pure confirm stays narrow.
  test('on a phone a form takes the full dialog width and a confirm stays inset', () => {
    const widths: Record<string, string | null> = {};
    for (const form of [true, false]) {
      const { unmount } = renderUi(
        () => (
          <SurfaceStackProvider>
            {form ? (
              <MutationModal
                visible
                onClose={() => {}}
                title="Rename"
                submitLabel="Save"
                operation={() => Promise.resolve()}
                successTitle="Saved"
              >
                <span>field</span>
              </MutationModal>
            ) : (
              <MutationModal
                visible
                onClose={() => {}}
                title="End space?"
                message="Everyone leaves."
                submitLabel="End space"
                operation={() => Promise.resolve()}
                successTitle="Ended"
              />
            )}
          </SurfaceStackProvider>
        ),
        { width: 390, height: 844 }
      );
      widths[form ? 'form' : 'confirm'] = mustQuery(
        '[data-component="ModalContent"]'
      ).getAttribute('data-size');
      unmount();
    }
    expect(widths).toEqual({ form: 'fullWidth', confirm: 'small' });
  });

  test('re-exports the shared lifecycle and resolves surface close per phase', () => {
    expect(typeof useMutationLifecycle).toBe('function');
    const onClose = mock();
    const dismissSuccess = mock();
    resolveMutationSurfaceClose({ phase: 'loading', onClose, dismissSuccess });
    expect(onClose).toHaveBeenCalledTimes(1);
    resolveMutationSurfaceClose({ phase: 'success', onClose, dismissSuccess });
    expect(dismissSuccess).toHaveBeenCalledTimes(1);
    resolveMutationSurfaceClose({ phase: 'error', onClose, dismissSuccess });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
