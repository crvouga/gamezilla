import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import type {
  GameRecordMetadata,
  GameSide,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { winningSides } from '@pkgs/turn-game-shared-ts/game-rules';
import { replayHearts } from './hearts-actions';
import { chooseHeartsDecision, heartsBots } from './hearts-bot';
import { DECK, parseCards } from './hearts-cards';
import { decodeHearts, HEARTS_SIDES } from './hearts-position';
import { heartsRules } from './hearts-rules';

/** The seats as the table names them, clockwise from the first: South, West, North, East. */
export function heartsSideLabel(side: GameSide): string {
  if (side === 'white') return 'South';
  if (side === 'black') return 'West';
  return side === 'red' ? 'North' : 'East';
}

/**
 * A finished match's portable record: who sat where, who won, the final
 * scores and every public action in order. It never holds a hand: only
 * cards every reader saw played.
 */
export function heartsRecord(
  position: string,
  history: string,
  metadata: GameRecordMetadata
): string {
  const final = decodeHearts(position);
  const actions = history === '' ? [] : history.split(' ');
  const winners = winningSides(metadata.outcome, HEARTS_SIDES).map(
    heartsSideLabel
  );
  return [
    '[Game "Hearts"]',
    ...HEARTS_SIDES.map(
      (side, seat) =>
        `[${heartsSideLabel(side)} "${metadata.participants[seat]?.name ?? ''}"]`
    ),
    `[Result "${winners.join(', ')}"]`,
    `[Scores "${final?.scores.join(', ') ?? ''}"]`,
    '',
    replayHearts(actions)
      .map((step) => step.label)
      .join(' '),
  ].join('\n');
}

export const heartsGameShared = defineGame({
  rules: heartsRules,
  capabilities: {
    'custom-games': { bots: heartsBots },
    history: { record: heartsRecord },
  },
  turnAutomation: {
    choose: (position, random, hand, strength = 'medium') =>
      chooseHeartsDecision(position, strength, random, hand),
    async perform(ui, board, action) {
      // A play is one card of the hand, played at once.
      const cards = parseCards(action) ?? [];
      if (cards.length <= 1) {
        for (const card of cards) {
          const target = ui.get(`${board}-card-${card}`);
          await target.wait('enabled');
          await target.tap();
        }
        return;
      }
      // A pass is three cards chosen on the hand, then confirmed. A refused
      // pass keeps its cards chosen so they can be sent again, so a card
      // still chosen that is not in this pass is put back first, and a card
      // of this pass already chosen stays chosen.
      for (const card of DECK) {
        if (cards.includes(card)) continue;
        const other = ui.get(`${board}-card-${card}`);
        if (
          (await other.isVisible()) &&
          (await other.attribute('aria-pressed')) === 'true'
        )
          await other.tap();
      }
      for (const card of cards) {
        const target = ui.get(`${board}-card-${card}`);
        await target.wait('enabled');
        if ((await target.attribute('aria-pressed')) !== 'true')
          await target.tap();
      }
      const confirm = ui.get(`${board}-pass`);
      await confirm.wait('enabled');
      await confirm.tap();
    },
  },
});
