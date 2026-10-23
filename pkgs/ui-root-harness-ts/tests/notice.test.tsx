/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { fireEvent } from '@solidjs/testing-library';
import { mustQuery, renderUi } from './render';

describe('Notice', () => {
  test('sits in the page flow with no dismiss control unless asked', () => {
    renderUi(() => <Notice tone="warning">{'Offline'}</Notice>);
    const notice = mustQuery('[data-component="Notice"]');
    expect(notice.getAttribute('data-tone')).toBe('warning');
    expect(notice.textContent).toBe('Offline');
    expect(
      document.querySelector('[data-component="NoticeDismiss"]')
    ).toBeNull();
  });

  test('onDismiss adds a labelled dismiss control that calls it', () => {
    const onDismiss = mock(() => undefined);
    renderUi(() => (
      <Notice tone="warning" onDismiss={onDismiss}>
        {"Your space wasn't renamed"}
      </Notice>
    ));
    const dismiss = mustQuery('[data-component="NoticeDismiss"]');
    expect(dismiss.getAttribute('aria-label')).toBe('Dismiss');
    fireEvent.click(dismiss);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
