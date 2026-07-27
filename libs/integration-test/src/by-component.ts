import type { Locator, Page } from '@playwright/test';

/**
 * Locate elements tagged with `data-component="<name>"` by the @pkgs/ui
 * component-id system (dev + E2E builds only).
 */
export function byComponent(page: Page, name: string): Locator {
  return page.locator(`[data-component="${name}"]`);
}

/**
 * Locate a screen root tagged with `data-screen="<screenId>"`.
 */
export function byScreen(page: Page, screenId: string): Locator {
  return page.locator(`[data-screen="${screenId}"]`);
}
