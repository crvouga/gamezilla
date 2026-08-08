import { by, type Driver, expectHidden, expectVisible } from '@pkgs/ui-testing';
import type { Page } from '@playwright/test';

import type { AuthPort } from '../support/auth-port';

const E2E_USER_EMAIL = 'e2e@gamezilla.test';
const BEARER_STORAGE_KEY = 'gamezilla.better-auth.bearer';

function apiOrigin(): string {
  const raw =
    process.env['EXPO_PUBLIC_API_URL']?.trim() ||
    process.env['API_URL']?.trim() ||
    '';
  if (raw.length === 0) {
    throw new Error(
      'EXPO_PUBLIC_API_URL or API_URL must be set for Better Auth browser E2E'
    );
  }
  return raw.replace(/\/$/, '');
}

async function mintE2eBearerToken(): Promise<string> {
  const res = await fetch(`${apiOrigin()}/api/identity/e2e/sign-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: E2E_USER_EMAIL }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`E2E sign-in mint failed (${String(res.status)}): ${body}`);
  }
  const json = (await res.json()) as { token?: unknown };
  const token = typeof json.token === 'string' ? json.token.trim() : '';
  if (token.length === 0) {
    throw new Error('E2E sign-in mint response missing token');
  }
  return token;
}

/**
 * AuthPort over Better Auth’s dev-only mint endpoint + localStorage bearer
 * injection. The Playwright `Page` stays private inside the web binding.
 */
export function createBetterAuthE2eAdapter(
  page: Page,
  driver: Driver
): AuthPort {
  return {
    async signIn(): Promise<void> {
      const token = await mintE2eBearerToken();
      await page.evaluate(
        ({ storageKey, bearer }) => {
          localStorage.setItem(storageKey, bearer);
        },
        { storageKey: BEARER_STORAGE_KEY, bearer: token }
      );
      await page.reload({ waitUntil: 'domcontentloaded' });
      await waitForSignedInReplication(page);
    },
    async signOut(): Promise<void> {
      await page.goto('/more/account');
      const signOut = by.role('button', 'Sign out');
      await expectVisible(driver, signOut);
      await driver.tap(signOut);
      // Confirm modal if present — MutationModal may show Sign out action again.
      try {
        await driver.tap(by.role('button', 'Sign out'));
      } catch {
        // already signed out / no confirm
      }
      await page.evaluate((storageKey) => {
        localStorage.removeItem(storageKey);
      }, BEARER_STORAGE_KEY);
    },
    async expectSignedOut(): Promise<void> {
      await page.goto('/more/account');
      await expectVisible(driver, by.role('button', 'Sign in'));
      await expectHidden(driver, by.role('button', 'Sign out'));
    },
  };
}

async function waitForSignedInReplication(page: Page): Promise<void> {
  await page
    .waitForResponse(
      (resp) => resp.url().includes('/identity/refresh') && resp.ok(),
      { timeout: 30_000 }
    )
    .catch(() => undefined);
}
