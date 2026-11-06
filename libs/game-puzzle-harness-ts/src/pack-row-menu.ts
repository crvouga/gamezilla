import { fireEvent } from '@solidjs/testing-library';
import type { mountContentExample } from './mount-content-example';

type View = Awaited<ReturnType<typeof mountContentExample>>;

/**
 * Choose "Move up" for one puzzle in the pack builder: open its row's "…"
 * menu, then the menu's Move up, as a person does. Throws when the row has
 * no menu or the move is not offered (the first puzzle).
 */
export function movePackRowUp(view: View, row: HTMLElement): void {
  const menu = row.querySelector<HTMLButtonElement>(
    '[data-testid="content-pack-menu"]'
  );
  if (menu === null) throw new Error('The pack row offers no menu');
  fireEvent.click(menu);
  const up = view.queryByTestId('content-pack-up');
  if (!(up instanceof HTMLButtonElement) || up.disabled)
    throw new Error('The pack row offers no move up');
  fireEvent.click(up);
}
