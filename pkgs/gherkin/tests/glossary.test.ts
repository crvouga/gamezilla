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
    domain === null
      ? 'specs/ubiquitous-language.yml'
      : `specs/${domain}/ubiquitous-language.yml`;
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
    {
      term: 'game',
      definition: 'One contest.',
      model: ['Game', 'games'],
      published: true,
    },
    { term: 'clock', definition: 'Time left.' },
    {
      term: 'flag',
      definition: "A clock reaching zero on the player's move.",
      published: true,
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
    { term: 'game', from: 'play', model: 'ratedGames' },
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
    ['var', 'ratedGames'],
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
      'specs/x/ubiquitous-language.yml',
      'x'
    );
    expect(parsed.problems).toEqual([
      'specs/x/ubiquitous-language.yml: terms[0] (widget): needs a "definition", an outside "source", or "from: <domain>"',
    ]);
  });

  test('a borrowed term keeps its owner definition and avoid', () => {
    const parsed = parseGlossary(
      {
        context: 'X',
        purpose: 'Y',
        terms: [
          { term: 'game', from: 'play', definition: 'Mine.', avoid: 'g' },
        ],
      },
      'specs/x/ubiquitous-language.yml',
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

  test('internal terms and quoted example data bind nobody else', () => {
    const features = [
      prose(
        'specs/ratings/clock.feature',
        `Feature: Ratings on the clock
  Scenario: A rating named "Flag day"
    Then the rating shows "Flag day"
`
      ),
    ];
    expect(checkLanguage(input({ features }))).toEqual([]);
  });

  test('only a published term can be borrowed', () => {
    const ratings = glossary('ratings', {
      context: 'Ratings',
      purpose: 'How strong each player is.',
      terms: [
        { term: 'rating', definition: 'A strength number.', model: 'ratings' },
        { term: 'game', from: 'play', model: 'ratedGames' },
        { term: 'clock', from: 'play' },
      ],
    });
    expect(
      checkLanguage(
        input({
          glossaries: new Map([
            ['play', PLAY],
            ['ratings', ratings],
          ]),
        })
      )
    ).toEqual([
      'specs/ratings/ubiquitous-language.yml: "clock" borrows from play, which does not publish it (published: true there)',
    ]);
  });

  test('a capitalized term is a name and matches only as written', () => {
    const app = glossary('app', {
      context: 'App',
      purpose: 'The app itself.',
      terms: [{ term: 'About', definition: 'Where the app says what it is.' }],
    });
    const features = [
      prose(
        'specs/play/about.feature',
        `Feature: A game about time
  Scenario: A flag is about time
    Then the game ends
`
      ),
    ];
    expect(
      checkLanguage(
        input({
          glossaries: new Map([
            ['play', PLAY],
            ['ratings', RATINGS],
            ['app', app],
          ]),
          features,
        })
      )
    ).toEqual([]);
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
      'specs/ratings/flags.feature:2: "flag" is play\'s term; borrow it in specs/ratings/ubiquitous-language.yml (term: flag, from: play) or define this context\'s own',
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
      'specs/play/game.qnt:3: action "finish" is not in the ubiquitous language — list it as a term\'s "model" in specs/play/ubiquitous-language.yml, or prefix a model helper with "_"',
      'specs/play/game.qnt:4: var "status" is not in the ubiquitous language — list it as a term\'s "model" in specs/play/ubiquitous-language.yml, or prefix a model helper with "_"',
      'specs/play/ubiquitous-language.yml: "game" names model "Game", which no Quint spec in specs/play/ declares',
      'specs/play/ubiquitous-language.yml: "game" names model "games", which no Quint spec in specs/play/ declares',
      'specs/play/ubiquitous-language.yml: "flag" names model "flag", which no Quint spec in specs/play/ declares',
    ]);
  });

  test('a context names a kernel term in its own models with from: kernel', () => {
    const ratings = glossary('ratings', {
      context: 'Ratings',
      purpose: 'How strong each player is.',
      terms: [
        { term: 'rating', definition: 'A strength number.', model: 'ratings' },
        { term: 'game', from: 'play', model: 'ratedGames' },
        { term: 'person', from: 'kernel', model: 'rated' },
      ],
    });
    const model = quint('specs/ratings/updates.qnt', [
      ['var', 'ratings'],
      ['var', 'ratedGames'],
      ['var', 'rated'],
    ]);
    expect(
      checkLanguage(
        input({
          glossaries: new Map([
            ['play', PLAY],
            ['ratings', ratings],
          ]),
          quint: [PLAY_MODEL, PLAY_EVENTS, model],
        })
      )
    ).toEqual([]);
  });

  test('only published events cross a context boundary', () => {
    const peeking = quint(
      'specs/ratings/updates.qnt',
      [
        ['type', 'Person'],
        ['var', 'ratings'],
        ['var', 'ratedGames'],
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
