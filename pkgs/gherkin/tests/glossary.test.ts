import { describe, expect, test } from 'bun:test';
import {
  checkLanguage,
  featureProse,
  type Glossary,
  type LanguageInput,
  parseGlossary,
  type QuintSpecNames,
} from '@pkgs/gherkin/glossary';

function glossary(domain: string | null, data: unknown): Glossary {
  const uri =
    domain === null ? 'specs/glossary.yaml' : `specs/${domain}/glossary.yaml`;
  const parsed = parseGlossary(data, uri, domain);
  expect(parsed.problems).toEqual([]);
  return parsed.glossary;
}

const KERNEL = glossary(null, {
  context: 'Shared kernel',
  purpose: 'People and devices.',
  terms: [
    {
      term: 'person',
      definition: 'Someone.',
      forms: ['people'],
      avoid: ['user'],
      model: 'Person',
    },
  ],
});

const PLAY = glossary('play', {
  context: 'Play',
  purpose: 'Games between two players.',
  terms: [
    { term: 'game', definition: 'One contest.', model: ['Game', 'games'] },
    {
      term: 'flag',
      definition: "A clock reaching zero on the player's move.",
      avoid: ['timeout'],
      model: 'flag',
    },
    { term: 'game ended', definition: 'A result was set.', model: 'GameEnded' },
    {
      term: 'what happened in play',
      definition: 'Facts play publishes.',
      model: 'Event',
    },
    { term: 'checkmate', source: 'FIDE Laws of Chess, Article 5.1.1' },
  ],
});

const RATINGS = glossary('ratings', {
  context: 'Ratings',
  purpose: 'How strong each player is.',
  terms: [
    { term: 'rating', definition: 'A strength number.', model: 'ratings' },
    { term: 'game', from: 'play' },
  ],
});

function quint(
  uri: string,
  declarations: readonly [string, string][],
  imports: readonly string[] = [],
  module: string | null = null
): QuintSpecNames {
  return {
    uri,
    domain: uri.split('/')[1] ?? '',
    module,
    imports: imports.map((from) => ({ from, line: 1 })),
    declarations: declarations.map(([kind, name], index) => ({
      kind,
      name,
      line: index + 2,
    })),
  };
}

const PLAY_MODEL = quint('specs/play/game.qnt', [
  ['type', 'Game'],
  ['type', 'Person'],
  ['var', 'games'],
  ['action', 'flag'],
  ['action', 'init'],
  ['action', 'step'],
  ['val', 'invOneResult'],
  ['val', 'PLAYERS'],
  ['def', '_bookkeeping'],
]);
const PLAY_EVENTS = quint(
  'specs/play/events.qnt',
  [
    ['type', 'Event'],
    ['variant', 'GameEnded'],
  ],
  [],
  'events'
);
const RATINGS_MODEL = quint(
  'specs/ratings/updates.qnt',
  [
    ['var', 'ratings'],
    ['action', 'GameEnded'],
  ],
  ['../play/events']
);

function input(overrides: Partial<LanguageInput> = {}): LanguageInput {
  return {
    kernel: KERNEL,
    glossaries: new Map([
      ['play', PLAY],
      ['ratings', RATINGS],
    ]),
    features: [],
    quint: [PLAY_MODEL, PLAY_EVENTS, RATINGS_MODEL],
    ...overrides,
  };
}

function prose(uri: string, text: string) {
  return {
    uri,
    domain: uri.split('/')[1] ?? '',
    lines: featureProse(text),
  };
}

describe('glossary files', () => {
  test('a term needs a definition, an outside source, or a lender', () => {
    const parsed = parseGlossary(
      { context: 'X', purpose: 'Y', terms: [{ term: 'widget' }] },
      'specs/x/glossary.yaml',
      'x'
    );
    expect(parsed.problems).toEqual([
      'specs/x/glossary.yaml: terms[0] (widget): needs a "definition", an outside "source", or "from: <domain>"',
    ]);
  });

  test('a borrowed term keeps its owner definition, avoid and model', () => {
    const parsed = parseGlossary(
      {
        context: 'X',
        purpose: 'Y',
        terms: [
          { term: 'game', from: 'play', definition: 'Mine.', model: 'g' },
        ],
      },
      'specs/x/glossary.yaml',
      'x'
    );
    expect(parsed.problems).toHaveLength(2);
  });
});

describe('ubiquitous language', () => {
  test('specs in their own language, with a borrowed term, pass', () => {
    const features = [
      prose(
        'specs/ratings/updates.feature',
        `Feature: Rating updates
  A game changes each person's rating once.

  Scenario: A game ends
    Given Alice has a rating of 1500
    When a game between Alice and Bob ends
    Then Alice's rating has moved
    | person | rating |
    | Alice  | flag   |
`
      ),
    ];
    expect(checkLanguage(input({ features }))).toEqual([]);
  });

  test('an avoided synonym is refused, even a kernel one', () => {
    const features = [
      prose(
        'specs/play/ending.feature',
        `Feature: Ending
  Scenario: The user runs out of time
    Then the game ends on timeout
`
      ),
    ];
    expect(checkLanguage(input({ features }))).toEqual([
      'specs/play/ending.feature:2: "user" — say "person" (the glossary avoids "user")',
      'specs/play/ending.feature:3: "timeout" — say "flag" (the glossary avoids "timeout")',
    ]);
  });

  test("another context's term must be borrowed", () => {
    const features = [
      prose(
        'specs/ratings/flags.feature',
        `Feature: Ratings after a game
  Scenario: A flag moves ratings
    Then the ratings move
`
      ),
    ];
    expect(checkLanguage(input({ features }))).toEqual([
      'specs/ratings/flags.feature:2: "flag" is play\'s term; borrow it in specs/ratings/glossary.yaml (term: flag, from: play) or define this context\'s own',
    ]);
  });

  test('every product-facing Quint name is a glossary model name', () => {
    const stray = quint('specs/play/game.qnt', [
      ['type', 'Person'],
      ['action', 'finish'],
      ['var', 'status'],
    ]);
    expect(
      checkLanguage(input({ quint: [stray, PLAY_EVENTS, RATINGS_MODEL] }))
    ).toEqual([
      'specs/play/game.qnt:3: action "finish" is not in the ubiquitous language — list it as a term\'s "model" in specs/play/glossary.yaml, or prefix a model helper with "_"',
      'specs/play/game.qnt:4: var "status" is not in the ubiquitous language — list it as a term\'s "model" in specs/play/glossary.yaml, or prefix a model helper with "_"',
      'specs/play/glossary.yaml: "game" names model "Game", which no Quint spec in specs/play/ declares',
      'specs/play/glossary.yaml: "game" names model "games", which no Quint spec in specs/play/ declares',
      'specs/play/glossary.yaml: "flag" names model "flag", which no Quint spec in specs/play/ declares',
    ]);
  });

  test('only published events cross a context boundary', () => {
    const peeking = quint(
      'specs/ratings/updates.qnt',
      [
        ['type', 'Person'],
        ['var', 'ratings'],
      ],
      ['../play/game']
    );
    expect(
      checkLanguage(input({ quint: [PLAY_MODEL, PLAY_EVENTS, peeking] }))
    ).toEqual([
      'specs/ratings/updates.qnt:1: imports "../play/game"; a context imports only published language — "./events" or "../<domain>/events"',
    ]);
  });

  test('the published language declares no state or actions', () => {
    const events = quint(
      'specs/play/events.qnt',
      [
        ['type', 'Event'],
        ['variant', 'GameEnded'],
        ['var', 'games'],
      ],
      [],
      'events'
    );
    expect(
      checkLanguage(input({ quint: [PLAY_MODEL, events, RATINGS_MODEL] }))
    ).toEqual([
      'specs/play/events.qnt:4: var games — the published language declares types and values only',
    ]);
  });
});
