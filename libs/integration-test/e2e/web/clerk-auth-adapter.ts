import { clerk } from '@clerk/testing/playwright';
import { by, type Driver, expectHidden, expectVisible } from '@pkgs/ui-testing';
import type { Page } from '@playwright/test';

import type { AuthPort } from '../support/auth-port';

function requireE2eClerkUserEmail(): string {
  const email = process.env['E2E_CLERK_USER_EMAIL']?.trim() ?? '';
  if (email.length === 0) {
    throw new Error(
      'E2E_CLERK_USER_EMAIL must be set for Clerk browser E2E (secrets env `dev` / CI secrets).'
    );
  }
  return email;
}

/**
 * AuthPort over `@clerk/testing/playwright`. The Playwright `Page` stays
 * private inside the web binding — scenarios never see it.
 */
export function createClerkAuthAdapter(page: Page, driver: Driver): AuthPort {
  return {
    async signIn(): Promise<void> {
      await clerk.signIn({
        page,
        emailAddress: requireE2eClerkUserEmail(),
      });
      await waitForSignedInReplication(page);
    },
    async signOut(): Promise<void> {
      await clerk.signOut({ page });
    },
    async expectSignedOut(): Promise<void> {
      // Header avatar menu is gone; assert via account screen actions.
      await page.goto('/more/account');
      await expectVisible(driver, by.role('button', 'Sign in'));
      await expectHidden(driver, by.role('button', 'Sign out'));
    },
  };
}

async function waitForSignedInReplication(page: Page): Promise<void> {
  await page
    .waitForResponse(
      (resp) => resp.url().includes('/auth/refresh') && resp.ok(),
      { timeout: 30_000 }
    )
    .catch(() => undefined);
}
