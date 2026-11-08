/** @jsxImportSource solid-js */
/**
 * When a pending publication is confirmed its notice goes away; nothing the
 * person can tap may move because of that.
 */

import { afterEach, expect, test } from 'bun:test';
import { ContentPublicationControlsView } from '@libs/game-puzzle-client-ts/content-publication-controls-view';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

const resolved = async (): Promise<void> => undefined;

// regression: puzzle-builder-pending-notice-shifts-view-edition
for (const layout of ['bar', 'stacked'] as const) {
  test(`${layout}: the pending notice sits after the edition actions, so its removal moves none of them`, () => {
    const time = createHarnessClock();
    renderWithI18n(() => (
      <ClockProvider clock={time.clock} timers={time.timers}>
        <ThemeProvider
          colorScheme="dark"
          fixedLayout={{ width: 390, height: 844 }}
        >
          <ContentPublicationControlsView
            copyState={{ kind: 'pending', connection: 'online' }}
            layout={layout}
            kind="puzzle"
            validation="valid"
            validationMessage=""
            proven
            pending="online"
            published
            disabled={false}
            onValidate={resolved}
            onPublish={resolved}
            onViewPublication={() => undefined}
            onWithdraw={resolved}
          />
        </ThemeProvider>
      </ClockProvider>
    ));
    const notice = screen.getByTestId('content-publication-pending');
    const view = screen.getByTestId('content-view-publication');
    expect(
      view.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
}
