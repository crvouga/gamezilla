import type {
  Driver,
  UiWaitOptions,
} from '@pkgs/ui-testing-root-shared-ts/driver';
import type { Card } from './hearts-cards';

/** Choose the cards in the hand, preserving any already chosen, then send the pass. */
export async function selectAndPassHeartsCards(
  ui: Driver,
  board: string,
  cards: readonly Card[],
  options?: UiWaitOptions
): Promise<void> {
  for (const card of cards) {
    const target = ui.get(`${board}-card-${card}`);
    await target.wait('enabled', options);
    if ((await target.attribute('aria-pressed')) === 'true') continue;
    await target.tap(options);
    if ((await target.attribute('aria-pressed')) !== 'true')
      throw new Error(`Hearts did not select ${card} for the pass`);
  }
  const confirm = ui.get(`${board}-pass`);
  await confirm.wait('enabled', options);
  await confirm.tap(options);
}
