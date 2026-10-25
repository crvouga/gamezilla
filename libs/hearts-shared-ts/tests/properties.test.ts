import { describe, test } from 'bun:test';
import { heartsBots } from '@libs/hearts-shared-ts/hearts-bot';
import { DECK, parseCards } from '@libs/hearts-shared-ts/hearts-cards';
import { decodeHearts } from '@libs/hearts-shared-ts/hearts-position';
import { heartsRules } from '@libs/hearts-shared-ts/hearts-rules';
import {
  cardRefusal,
  legalCards,
  takenPoints,
  tricksOf,
} from '@libs/hearts-shared-ts/hearts-tricks';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { createSeededRng } from '@pkgs/uuid-shared-ts/seeded-rng';
import fc from 'fast-check';
import {
  dealtTable,
  finished,
  HEARTS_SIDES,
  handOf,
  pass,
  pendingPasses,
  play,
  type Table,
  turn,
} from './hearts-table';

const must = (holds: boolean, problem: string): void => {
  if (!holds) throw new Error(problem);
};
const seeds = fc.integer({ min: 1, max: 2 ** 31 - 1 });

/**
 * Cards sent at `before` by the side to move are accepted exactly when they
 * are legal, and a refused one changes nothing.
 */
function strangersRefused(before: Table, strangers: readonly string[]): void {
  const mover = turn(before);
  for (const stranger of strangers) {
    const probe = snapshot(before);
    const legal = heartsRules.hands!.proposals(
      probe.position,
      handOf(probe, mover)
    );
    const accepted = play(probe, stranger);
    must(
      accepted === legal.includes(stranger as never),
      `${stranger} accepted against its legality`
    );
    if (!accepted)
      must(
        probe.position === before.position &&
          probe.hidden === before.hidden &&
          probe.actions.length === before.actions.length,
        'a refused card changed the table'
      );
  }
}

/**
 * The 52 cards are partitioned across the hands held and the cards played
 * this deal (the current trick and every taken trick): none lost, none
 * duplicated.
 */
function conserved(table: Table): void {
  const position = decodeHearts(table.position)!;
  if (position.phase === 'done') return;
  const held = HEARTS_SIDES.flatMap((side) => parseCards(handOf(table, side))!);
  const all = [...held, ...position.plays];
  must(all.length === 52, `${all.length} cards at ${table.position}`);
  must(new Set(all).size === 52, `a card is duplicated at ${table.position}`);
  must(
    DECK.every((card) => all.includes(card)),
    'a card is missing'
  );
}

/** One decision of the seat deciding now, as its bot; the table after it. */
function decide(table: Table, random: () => number): void {
  const passing = pendingPasses(table);
  const side = passing[0] ?? turn(table);
  const choice = heartsBots.choose(
    table.position,
    'medium',
    random,
    handOf(table, side)
  );
  if (choice === null) throw new Error(`${side} had nothing to decide`);
  must(
    passing.length > 0 ? pass(table, side, choice) : play(table, choice),
    `${side}'s ${choice} was refused`
  );
}

/** The table as it stood before a decision: what the checks compare against. */
function snapshot(table: Table): Table {
  return {
    ...table,
    actions: [...table.actions],
    commitments: { ...table.commitments },
    steps: table.steps.slice(-1),
  };
}

/** A whole match decided by bots, checking `each` after every decision. */
function match(
  seed: number,
  each: (table: Table, before: Table) => void
): Table {
  const rng = createSeededRng(seed);
  const table = dealtTable(rng.random);
  for (let decision = 0; decision < 6000 && !finished(table); decision += 1) {
    const before = snapshot(table);
    decide(table, rng.random);
    each(table, before);
  }
  must(finished(table), 'the match did not finish');
  return table;
}

describe('Hearts properties', () => {
  test('card conservation holds after every decision of a match', () => {
    assertProperty(
      'card conservation',
      fc.property(seeds, (seed) => {
        match(seed, (table) => conserved(table));
      }),
      { numRuns: 6 }
    );
  });

  test('passing keeps the deck and every hand at thirteen, each card moving once to its target', () => {
    assertProperty(
      'passing',
      fc.property(seeds, (seed) => {
        match(seed, (table, before) => {
          const action = table.actions.at(-1);
          if (
            action === undefined ||
            !action.startsWith('pass:') ||
            before.actions.length === table.actions.length
          )
            return;
          const deal = decodeHearts(before.position)!.deal;
          const offset = [1, 3, 2][(deal - 1) % 4]!;
          for (const [seat, side] of HEARTS_SIDES.entries()) {
            const hand = parseCards(handOf(table, side))!;
            must(
              hand.length === 13,
              `${side} holds ${hand.length} after passing`
            );
            const given = parseCards(before.commitments[side] ?? '') ?? [];
            const target = HEARTS_SIDES[(seat + offset) % 4]!;
            must(
              given.every((card) =>
                parseCards(handOf(table, target))!.includes(card)
              ),
              `${side}'s passed cards did not all reach ${target}`
            );
          }
        });
      }),
      { numRuns: 4 }
    );
  });

  test('a deal is exactly thirteen tricks of four cards, each won by one seat, and holds twenty-six penalty points', () => {
    assertProperty(
      'tricks and points',
      fc.property(seeds, (seed) => {
        match(seed, (table, before) => {
          const was = decodeHearts(before.position)!;
          if (was.phase !== 'play' || was.plays.length !== 51) return;
          const complete = {
            ...was,
            plays: [...was.plays, table.actions.at(-1)!.slice(0, 2) as never],
          };
          const tricks = tricksOf(complete);
          must(
            tricks.length === 13 && tricks.every((t) => t.cards.length === 4),
            'not thirteen full tricks'
          );
          const points = takenPoints(complete);
          must(
            points.reduce((a, b) => a + b, 0) === 26,
            `the deal held ${points.join('+')} points`
          );
        });
      }),
      { numRuns: 8 }
    );
  });

  test("a legal card leaves exactly its player's hand; a refused card changes nothing", () => {
    assertProperty(
      'plays and refusals',
      fc.property(
        seeds,
        fc.array(fc.constantFrom(...DECK), { minLength: 1, maxLength: 6 }),
        (seed, strangers) => {
          match(seed, (table, before) => {
            const position = decodeHearts(before.position)!;
            if (position.phase !== 'play' || pendingPasses(before).length > 0)
              return;
            const mover = turn(before);
            const card = table.actions.at(-1)!.slice(0, 2);
            const was = parseCards(handOf(before, mover))!;
            if (table.actions.at(-1)!.includes('+deal')) return;
            const now = parseCards(handOf(table, mover))!;
            must(
              was.length - now.length === 1 && !now.includes(card as never),
              'a card did not leave its hand'
            );
            for (const side of HEARTS_SIDES.filter((s) => s !== mover))
              must(
                handOf(before, side) === handOf(table, side),
                `${side}'s hand changed on another's play`
              );
            strangersRefused(before, strangers);
          });
        }
      ),
      { numRuns: 4 }
    );
  });

  test('the same seed and decisions give the same match, public and hidden', () => {
    assertProperty(
      'determinism',
      fc.property(seeds, (seed) => {
        const first = match(seed, () => {});
        const second = match(seed, () => {});
        must(
          JSON.stringify(first) === JSON.stringify(second),
          'the same seed played differently'
        );
        must(
          heartsRules.replay(first.actions, first.actions.length) ===
            first.position,
          'replaying the public actions reached another position'
        );
      }),
      { numRuns: 4 }
    );
  });

  test('a refusal is explained exactly when the rules refuse a card, and only then', () => {
    assertProperty(
      'refusals',
      fc.property(seeds, fc.integer({ min: 0, max: 300 }), (seed, at) => {
        const rng = createSeededRng(seed);
        const table = dealtTable(rng.random);
        for (let n = 0; n < at && !finished(table); n += 1)
          decide(table, rng.random);
        const position = decodeHearts(table.position)!;
        if (position.phase !== 'play') return;
        const seat = HEARTS_SIDES.indexOf(turn(table) as never) as 0;
        const hand = parseCards(handOf(table, turn(table)))!;
        const legal = legalCards(position, seat, hand);
        for (const card of DECK)
          must(
            (cardRefusal(position, seat, hand, card) === null) ===
              legal.includes(card),
            `${card} is explained against the rules at ${table.position}`
          );
      }),
      { numRuns: 20 }
    );
  });

  test('every bot decision is one its seat may make', () => {
    assertProperty(
      'bots decide legally',
      fc.property(
        seeds,
        fc.constantFrom('easy' as const, 'medium' as const),
        (seed, difficulty) => {
          const rng = createSeededRng(seed);
          const table = dealtTable(rng.random);
          for (
            let decision = 0;
            decision < 6000 && !finished(table);
            decision += 1
          ) {
            const passing = pendingPasses(table);
            const side = passing[0] ?? turn(table);
            const choice = heartsBots.choose(
              table.position,
              difficulty,
              rng.random,
              handOf(table, side)
            );
            if (passing.length === 0)
              must(
                heartsRules
                  .hands!.proposals(table.position, handOf(table, side))
                  .includes(choice as never),
                `${side}'s bot chose ${String(choice)}, which it may not play`
              );
            must(
              passing.length > 0
                ? pass(table, side, choice!)
                : play(table, choice!),
              `${side}'s ${String(choice)} was refused`
            );
          }
          must(finished(table), 'the bots did not finish the match');
        }
      ),
      { numRuns: 6 }
    );
  });
});
