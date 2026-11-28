import { expect, type Locator, type Page } from '@playwright/test';
import { measuredStep } from './action-evidence';
import { markEvidencePhase } from './evidence';

export type WordTilesInput = 'mouse' | 'touch' | 'keyboard';

export async function activate(
  target: Locator,
  input: WordTilesInput
): Promise<void> {
  if (input === 'keyboard') {
    await target.focus();
    await target.press('Enter');
  } else if (input === 'touch') {
    await target.tap();
  } else {
    await target.click();
  }
}

/** Exercise real input and authority settlement, including editing before submission. */
export async function playWord(
  page: Page,
  input: WordTilesInput,
  afterPlacement?: () => Promise<void>
): Promise<void> {
  await markEvidencePhase(page, 'native-word-editing');
  await measuredStep(
    page,
    'Place C, retract it, then move it to g8',
    async () => {
      await activate(page.getByTestId('game-session-board-rack-11'), input);
      const center = page.getByTestId('game-session-board-cell-h8');
      await activate(center, input);
      await expect(center).toHaveAttribute('data-state', 'tentative');
      await activate(center, input);
      await expect(center).toHaveAttribute('data-state', 'empty');
    }
  );
  for (const [tile, cell] of [
    ['11', 'g8'],
    ['0', 'h8'],
    ['82', 'i8'],
  ] as const) {
    await measuredStep(page, `Place tile ${tile} at ${cell}`, async () => {
      await activate(
        page.getByTestId(`game-session-board-rack-${tile}`),
        input
      );
      const target = page.getByTestId(`game-session-board-cell-${cell}`);
      await activate(target, input);
      await expect(target).toHaveAttribute('data-state', 'tentative');
    });
  }
  await afterPlacement?.();
  await measuredStep(
    page,
    'Submit CAT and read the accepted score and next turn',
    async () => {
      await markEvidencePhase(page, 'native-submission');
      const submit = page.getByTestId('game-session-board-submit');
      await expect(submit).toBeEnabled();
      await expect(page.getByTestId('game-session-board-status')).toContainText(
        '10'
      );
      await activate(submit, input);
      await expect(
        page.getByTestId('game-session-board-cell-h8')
      ).toHaveAttribute('data-state', 'recent');
      await expect(submit).toBeDisabled();
      await expect(
        page.getByTestId('game-session-white').getByText('10', { exact: true })
      ).toBeVisible();
      await expect(page.getByTestId('game-session-status')).toContainText(
        'jordan_plays to play'
      );
    }
  );
}
