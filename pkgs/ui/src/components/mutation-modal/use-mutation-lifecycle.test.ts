import { describe, expect, test } from 'bun:test';
import type { AsyncStatus } from '@pkgs/async/use-async';
import { mutationPhaseFromStatus } from './use-mutation-lifecycle';

describe('mutationPhaseFromStatus', () => {
  test('running maps to the loading phase', () => {
    expect(mutationPhaseFromStatus('running')).toBe('loading');
  });

  test('success and error map to their own phases', () => {
    expect(mutationPhaseFromStatus('success')).toBe('success');
    expect(mutationPhaseFromStatus('error')).toBe('error');
  });

  test('idle and cancelled both return the editable idle body', () => {
    expect(mutationPhaseFromStatus('idle')).toBe('idle');
    expect(mutationPhaseFromStatus('cancelled')).toBe('idle');
  });

  test('every async status maps to exactly one phase', () => {
    const statuses: AsyncStatus[] = [
      'idle',
      'running',
      'success',
      'error',
      'cancelled',
    ];
    for (const status of statuses) {
      expect(['idle', 'loading', 'success', 'error']).toContain(
        mutationPhaseFromStatus(status)
      );
    }
  });
});
