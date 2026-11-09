import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { observeBotGameJourney, startBotGameJourney } from './bot-game-journey';
import { check, JOURNEY_WAIT_MS, tap } from './journey-gestures';
import type { JourneyHost } from './journey-types';

const BOARD = 'custom-game-board';
/** The table's turn line: whose turn it is, or who took the last trick. */
const TURN_LINE = `${BOARD}-center`;
const DECK = [...'CDSH'].flatMap((suit) =>
  [...'23456789TJQKA'].map((rank) => `${rank}${suit}`)
);
/** One look at the turn line; the bots play on between looks. */
const LOOK_MS = 1_000;

/** The cards the person sees in their own hand, by their controls. */
async function handShown(ui: Driver): Promise<string[]> {
  const shown: string[] = [];
  for (const card of DECK)
    if (await ui.get(`${BOARD}-card-${card}`).isVisible()) shown.push(card);
  return shown;
}

/** Cards played this deal, from the board's public position. */
async function cardsPlayed(ui: Driver): Promise<number> {
  const position = (await ui.get(BOARD).attribute('data-position')) ?? '';
  const plays = position.split(':')[5] ?? '-';
  return plays === '-' ? 0 : plays.length / 2;
}

/** Whether the turn line shows `text` within one look. */
async function shows(ui: Driver, text: string): Promise<boolean> {
  try {
    await ui
      .get(TURN_LINE)
      .wait({ text, exact: false }, { timeoutMs: LOOK_MS });
    return true;
  } catch {
    return false;
  }
}

/** Wait until the table asks the person for a card: their turn, or their lead. */
async function awaitPersonToPlay(ui: Driver): Promise<void> {
  for (let looked = 0; looked < JOURNEY_WAIT_MS; looked += 2 * LOOK_MS) {
    if (await shows(ui, 'Your turn.')) return;
    if (await shows(ui, 'You took the trick')) return;
  }
  throw new Error('Hearts never asked Alice to play a card');
}

/** Choose three cards with their controls and pass them. */
async function passThree(ui: Driver): Promise<void> {
  const hand = await handShown(ui);
  check(hand.length === 13, `Hearts dealt ${hand.length} cards, not 13`);
  for (const card of hand.slice(0, 3)) await tap(ui, `${BOARD}-card-${card}`);
  await tap(ui, `${BOARD}-pass`);
  await ui.get(`${BOARD}-pass`).expect.hidden({ timeoutMs: JOURNEY_WAIT_MS });
}

/** On the person's first turn, play the first card the rules allow. */
async function playFirstAllowed(ui: Driver): Promise<void> {
  await awaitPersonToPlay(ui);
  const hand = await handShown(ui);
  check(hand.length === 13, `Alice holds ${hand.length} cards before playing`);
  for (const card of hand) {
    const control = ui.get(`${BOARD}-card-${card}`);
    if ((await control.attribute('aria-disabled')) !== 'false') continue;
    await control.tap({ timeoutMs: JOURNEY_WAIT_MS });
    await control.expect.hidden({ timeoutMs: JOURNEY_WAIT_MS });
    return;
  }
  throw new Error('Hearts allowed Alice no card on her turn');
}

/** Start Hearts against bots, pass three cards and play into the first trick. */
export async function playHeartsFirstTrick(host: JourneyHost): Promise<void> {
  await startBotGameJourney(host, 'Hearts');
  await observeBotGameJourney(host, 'Hearts');
  await host.act('passThreeHeartsCards', passThree);
  await host.act('playHeartsFirstTrick', playFirstAllowed);
}

/**
 * The first trick is taken: play has come back round to the person, who
 * has played once and holds the twelve cards left.
 */
export async function observeHeartsFirstTrick(
  host: Pick<JourneyHost, 'act'>
): Promise<void> {
  await host.act('observeHeartsFirstTrick', async (ui) => {
    for (let looked = 0; ; looked += 2 * LOOK_MS) {
      await awaitPersonToPlay(ui);
      if ((await cardsPlayed(ui)) >= 4) break;
      check(looked < JOURNEY_WAIT_MS, 'The first trick was never taken');
      // Give the bots one look's time to play on.
      await shows(ui, ' to play.');
    }
    const hand = await handShown(ui);
    check(hand.length === 12, `Alice holds ${hand.length} cards, not 12`);
  });
}
