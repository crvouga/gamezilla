import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';

/** Existing public UI only; diagnostic reads must never replace the failure. */
export async function publicJourneyText(
  ui: Driver,
  id: string
): Promise<string | null> {
  try {
    return (await ui.get(id).text())?.slice(0, 240) ?? null;
  } catch {
    return null;
  }
}

export async function publicJourneyVisible(
  ui: Driver,
  id: string
): Promise<boolean | null> {
  try {
    return await ui.get(id).isVisible();
  } catch {
    return null;
  }
}

export async function publicJourneyCaption(
  ui: Driver,
  id: string
): Promise<string | null> {
  try {
    return (await ui.get(id).attribute('aria-label'))?.slice(0, 240) ?? null;
  } catch {
    return null;
  }
}
