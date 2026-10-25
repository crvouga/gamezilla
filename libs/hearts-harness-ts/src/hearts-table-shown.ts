/**
 * The Hearts table read off rendered markup alone: each seat as the words it
 * is named with, its facts (cards held, score, whether it has passed),
 * whether it is marked as deciding, and the card it put in the trick; the
 * viewer's hand, each card as its face and whether it is chosen or allowed;
 * the sentence the table says what it is doing in; and the pass control. It
 * loads no client code, so a real browser's page is read the same way.
 */

import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';

export type HeartsSeatShown = {
  /** The words the seat is named with (`South (you)`). */
  readonly name: string;
  /** Each fact as shown: `13 cards`, `Score 0`, `Passed`. */
  readonly facts: readonly string[];
  /** Whether the seat is marked as deciding now, other than by colour. */
  readonly deciding: boolean;
  /** The card the seat put in the trick shown, if any. */
  readonly played: string | null;
};

export type HeartsCardShown = {
  readonly card: string;
  /** The words the card is read out with. */
  readonly label: string;
  /** What its face shows, in order: rank, symbol and suit name. */
  readonly face: readonly string[];
  /** Whether it is chosen to pass (or was passed). */
  readonly chosen: boolean;
  /** Whether the rules let it be played or chosen now. */
  readonly allowed: boolean;
};

export type HeartsTableShown = {
  readonly seats: Readonly<Partial<Record<GameSide, HeartsSeatShown>>>;
  readonly hand: readonly HeartsCardShown[];
  /** What the table says it is doing, in words. */
  readonly center: string;
  /** The control that passes the chosen cards, when it is offered. */
  readonly pass: { readonly label: string; readonly enabled: boolean } | null;
  /** Every card shown anywhere on the page, by its own mark. */
  readonly cardsOnPage: readonly string[];
};

const SIDES: readonly GameSide[] = ['white', 'black', 'red', 'blue'];

const ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
};

function unescape(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e] ?? e);
}

function attributes(tag: string): ReadonlyMap<string, string> {
  const found = new Map<string, string>();
  for (const match of tag.matchAll(/([a-z-]+)="([^"]*)"/g))
    found.set(match[1]!, unescape(match[2]!));
  return found;
}

/** The words of `markup`, each run of text between tags its own. */
function words(markup: string): string[] {
  return markup
    .split(/<[^>]*>/)
    .map((text) => unescape(text).trim())
    .filter((text) => text !== '');
}

function seatsShown(
  html: string,
  board: string
): Partial<Record<GameSide, HeartsSeatShown>> {
  const seats: Partial<Record<GameSide, HeartsSeatShown>> = {};
  for (const match of html.matchAll(/<section([^>]*)>([\s\S]*?)<\/section>/g)) {
    const attrs = attributes(match[1]!);
    const side = SIDES.find(
      (each) => attrs.get('data-testid') === `${board}-seat-${each}`
    );
    if (side === undefined) continue;
    const body = match[2]!;
    const name = attrs.get('aria-label') ?? '';
    const played = /data-card="([2-9TJQKA][CDSH])"/.exec(body)?.[1] ?? null;
    const facts = words(body.replace(/<span[^>]*-played"[\s\S]*$/, ''));
    seats[side] = {
      name,
      facts: facts.filter((fact) => fact !== name),
      deciding: attrs.get('aria-current') === 'step',
      played,
    };
  }
  return seats;
}

function handShown(html: string, board: string): HeartsCardShown[] {
  const hand: HeartsCardShown[] = [];
  for (const match of html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)) {
    const attrs = attributes(match[1]!);
    const testId = attrs.get('data-testid') ?? '';
    if (!testId.startsWith(`${board}-card-`)) continue;
    hand.push({
      card: testId.slice(`${board}-card-`.length),
      label: attrs.get('aria-label') ?? '',
      face: words(match[2]!),
      chosen: attrs.get('aria-pressed') === 'true',
      allowed: attrs.get('aria-disabled') !== 'true',
    });
  }
  return hand;
}

function passShown(html: string, board: string): HeartsTableShown['pass'] {
  for (const match of html.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)) {
    const attrs = attributes(match[1]!);
    if (attrs.get('data-testid') !== `${board}-pass`) continue;
    return {
      label: words(match[2]!).join(' '),
      enabled: !attrs.has('disabled') && attrs.get('aria-disabled') !== 'true',
    };
  }
  return null;
}

/** The Hearts table `board` as `html` renders it. */
export function heartsTableShownIn(
  html: string,
  board: string
): HeartsTableShown {
  const center = new RegExp(
    `<p[^>]*data-testid="${board}-center"[^>]*>([\\s\\S]*?)</p>`
  ).exec(html)?.[1];
  return {
    seats: seatsShown(html, board),
    hand: handShown(html, board),
    center: center === undefined ? '' : words(center).join(' '),
    pass: passShown(html, board),
    cardsOnPage: [...html.matchAll(/data-card="([2-9TJQKA][CDSH])"/g)].map(
      (match) => match[1]!
    ),
  };
}
