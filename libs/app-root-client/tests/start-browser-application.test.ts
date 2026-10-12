import { describe, expect, test } from 'bun:test';
import {
  showBrowserStartupFailure,
  startBrowserApplication,
} from '@libs/app-root-client/start-browser-application';

function starter(overrides: {
  readonly load: () => Promise<unknown>;
  readonly recoveryAttempted?: boolean;
}) {
  const events: string[] = [];
  return {
    events,
    value: {
      load: overrides.load,
      recoverOnce: true,
      recoveryAttempted: () => overrides.recoveryAttempted ?? false,
      markRecoveryAttempted: () => events.push('mark'),
      clearRecoveryAttempted: () => events.push('clear'),
      reload: () => events.push('reload'),
      showFailure: () => events.push('failure'),
    },
  };
}

describe('browser application startup', () => {
  test('reloads once when the development module import fails', async () => {
    // regression: dev-startup-import-failure-hangs
    const setup = starter({
      load: () => Promise.reject(new TypeError('module import failed')),
    });

    await startBrowserApplication(setup.value);

    expect(setup.events).toEqual(['mark', 'reload']);
  });

  test('shows the failure after the recovery was already attempted', async () => {
    const error = new TypeError('module import failed');
    const setup = starter({
      load: () => Promise.reject(error),
      recoveryAttempted: true,
    });

    await expect(startBrowserApplication(setup.value)).rejects.toBe(error);
    expect(setup.events).toEqual(['failure']);
  });

  test('clears the recovery marker after a successful load', async () => {
    const setup = starter({ load: () => Promise.resolve() });

    await startBrowserApplication(setup.value);

    expect(setup.events).toEqual(['clear']);
  });

  test('replaces the spinner with a reloadable failure', () => {
    const shell = document.createElement('div');
    shell.dataset['startupShell'] = '';
    document.body.append(shell);
    let reloads = 0;

    showBrowserStartupFailure({
      document,
      reload: () => {
        reloads += 1;
      },
      error: new TypeError('module import failed'),
    });

    expect(shell.getAttribute('aria-label')).toBe('Gamezilla failed to start');
    expect(shell.textContent).toContain('module import failed');
    shell.querySelector<HTMLButtonElement>('button')?.click();
    expect(reloads).toBe(1);
    shell.remove();
  });
});
