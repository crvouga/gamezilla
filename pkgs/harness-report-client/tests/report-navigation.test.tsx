import { expect, test } from 'bun:test';
import {
  mountReport,
  OTHER_SHA,
  SHA,
  settleReport,
  TEST_HASH,
} from './report-navigation-fixture';

for (const width of [390, 1440]) {
  test(`revision selection is on demand, cancellable and navigable at ${width}px`, async () => {
    // regression: report-revisions-crowded
    const app = mountReport(width, '#/?tab=tests');
    try {
      await settleReport();
      expect(
        app.host.querySelector('[data-testid="report-versions"]')
      ).toBeNull();
      const choose = app.host.querySelector<HTMLButtonElement>(
        '[data-testid="report-change-revision"]'
      );
      expect(choose).not.toBeNull();
      choose!.focus();
      choose!.click();
      await settleReport();
      const dialog = app.host.querySelector('[role="dialog"]');
      expect(dialog).not.toBeNull();
      expect(dialog!.contains(document.activeElement)).toBe(true);
      dialog!.querySelector('input')!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'k',
          ctrlKey: true,
          bubbles: true,
        })
      );
      expect(app.host.querySelectorAll('[role="dialog"]')).toHaveLength(1);
      expect(
        dialog!
          .querySelector(`[data-sha="${SHA}"]`)
          ?.getAttribute('aria-current')
      ).toBe('true');
      app.host
        .querySelector<HTMLButtonElement>(
          '[data-testid="report-close-revisions"]'
        )!
        .click();
      expect(app.host.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement === choose).toBe(true);
      expect(app.opened).toEqual([]);
      choose!.click();
      await settleReport();
      document.activeElement!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
        })
      );
      expect(app.host.querySelector('[role="dialog"]')).toBeNull();
      expect(app.readHash()).toBe('#/?tab=tests');
      choose!.click();
      await settleReport();
      app.host
        .querySelector<HTMLButtonElement>(`[data-sha="${OTHER_SHA}"]`)!
        .click();
      await settleReport();
      expect(app.opened).toEqual([OTHER_SHA]);
      expect(app.host.textContent).toContain(OTHER_SHA.slice(0, 9));
      expect(
        app.host.querySelector('[data-screen="report-version"]')
      ).not.toBeNull();
      expect(app.host.querySelector('[role="dialog"]')).toBeNull();
      expect(
        app.host.querySelector('[data-testid="report-versions"]')
      ).toBeNull();
    } finally {
      app.dispose();
    }
  });

  test(`a deep-linked interrupted test has an explicit route to all reports at ${width}px`, async () => {
    // regression: report-root-navigation-missing
    const app = mountReport(width, TEST_HASH);
    try {
      await settleReport();
      expect(app.host.querySelector('.sr-test')).not.toBeNull();
      app.host
        .querySelector<HTMLButtonElement>(
          '[data-testid="report-change-revision"]'
        )!
        .click();
      await settleReport();
      document.activeElement!.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
        })
      );
      expect(app.readHash()).toBe(TEST_HASH);
      expect(app.host.querySelector('.sr-test')).not.toBeNull();
      const home = app.host.querySelector<HTMLButtonElement>(
        '[data-testid="report-all-reports"]'
      );
      expect(home?.textContent).toContain('All reports');
      home!.click();
      await settleReport();
      expect(app.opened).toEqual([null]);
      expect(app.host.querySelector('[data-screen="reports"]')).not.toBeNull();
      expect(app.host.querySelector('.sr-test')).toBeNull();
    } finally {
      app.dispose();
    }
  });
}
