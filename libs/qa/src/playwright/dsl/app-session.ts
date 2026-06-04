import type { Page } from '@playwright/test';

import { expectAppBooted } from '../helpers/app-boot';
import { AuthDSL } from './auth';

/** Facade for a single browser session against the web app. */
export class AppSession {
  readonly auth: AuthDSL;

  constructor(private readonly page: Page) {
    this.auth = new AuthDSL(page);
  }

  /** Step 1: app shell and spaces screen are ready. */
  async expectBooted(): Promise<void> {
    await expectAppBooted(this.page);
  }
}

export function createAppSession(page: Page): AppSession {
  return new AppSession(page);
}
