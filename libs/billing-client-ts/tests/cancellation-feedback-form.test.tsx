import { afterEach, expect, test } from 'bun:test';
import { CancellationFeedbackForm } from '@libs/billing-client-ts/cancellation-feedback-form';
import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

afterEach(cleanup);

// regression: billing-feedback-rejection-reports-success
test('a refused saved answer remains editable with retry and no success claim', async () => {
  const clock = createHarnessClock();
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  const [delivery, setDelivery] = createSignal<'pending' | 'rejected'>(
    'pending'
  );
  const answers: unknown[] = [];
  render(() => (
    <I18nProvider i18n={i18n}>
      <ClockProvider clock={clock.clock} timers={clock.timers}>
        <ThemeProvider
          colorScheme="light"
          fixedLayout={{ width: 390, height: 844 }}
        >
          <CancellationFeedbackForm
            saved={{ reason: 'price', comment: 'Too expensive this month.' }}
            online
            delivery={delivery()}
            onSave={async (answer) => {
              answers.push(answer);
            }}
          />
        </ThemeProvider>
      </ClockProvider>
    </I18nProvider>
  ));
  expect(screen.getByTestId('billing-feedback-saved').textContent).toContain(
    'Waiting to share'
  );
  setDelivery('rejected');
  expect(screen.queryByTestId('billing-feedback-saved')).toBeNull();
  expect(screen.getByRole('alert').textContent).toContain(
    'Your answer is still here'
  );
  const comment = screen.getByTestId(
    'billing-feedback-comment'
  ) as HTMLTextAreaElement;
  expect(comment.value).toBe('Too expensive this month.');
  fireEvent.click(screen.getByTestId('billing-feedback-save'));
  await Promise.resolve();
  expect(answers).toEqual([
    { reason: 'price', comment: 'Too expensive this month.' },
  ]);
});
