import { describe, expect, test } from 'bun:test';
import {
  showBrowserStartupFailure,
  startBrowserApplication,
  startupFailureReference,
} from '@libs/app-root-client-ts/start-browser-application';
import { PRODUCT_NAME } from '@libs/product-identity-shared-ts/product-identity';

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

  test('replaces the spinner with a reloadable failure in development', () => {
    const shell = document.createElement('div');
    shell.dataset['startupShell'] = '';
    document.body.append(shell);
    let reloads = 0;

    showBrowserStartupFailure({
      document,
      reload: () => {
        reloads += 1;
      },
      development: true,
      reference: 'c361365-1f0e8a2b',
      error: new TypeError('module import failed'),
    });

    expect(shell.getAttribute('aria-label')).toBe(
      `${PRODUCT_NAME} failed to start`
    );
    expect(shell.textContent).toContain(
      'Vite may still be preparing the page.'
    );
    expect(shell.textContent).toContain('module import failed');
    shell.querySelector<HTMLButtonElement>('button')?.click();
    expect(reloads).toBe(1);
    shell.remove();
  });

  // regression: startup-failure-dev-copy-in-production
  test('a production failure gives plain advice, a reference and Reload', () => {
    const shell = document.createElement('div');
    shell.dataset['startupShell'] = '';
    document.body.append(shell);
    let reloads = 0;

    showBrowserStartupFailure({
      document,
      reload: () => {
        reloads += 1;
      },
      development: false,
      reference: startupFailureReference(
        'c361365e5a1b2c3d4e5f60718293a4b5c6d7e8f9',
        () => '1f0e8a2b-7c3d-4e5f-9a1b-2c3d4e5f6a7b'
      ),
    });

    expect(shell.textContent).not.toContain('Vite');
    expect(shell.textContent).not.toContain('Unknown startup error');
    expect(shell.textContent).toContain(`${PRODUCT_NAME} couldn’t open`);
    expect(shell.textContent).toContain(
      'Anything already saved on this device is kept.'
    );
    expect(shell.textContent).toContain('Reference: c361365-1f0e8a2b');
    shell.querySelector<HTMLButtonElement>('button')?.click();
    expect(reloads).toBe(1);
    shell.remove();
  });

  test('a build without a commit still yields a reference', () => {
    expect(startupFailureReference('', () => 'abcdef12-3456')).toBe(
      'unknown-abcdef12'
    );
  });
});
