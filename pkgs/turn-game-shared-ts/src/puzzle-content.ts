/** The framework never interprets a game's definition, action or saved state. */
export type PuzzleIssue = {
  readonly code: string;
  readonly message: string;
};

export type PuzzleValidation =
  | { readonly valid: true }
  | { readonly valid: false; readonly issues: readonly PuzzleIssue[] };

export type PuzzleChange =
  | { readonly accepted: true; readonly state: string }
  | { readonly accepted: false; readonly issues: readonly PuzzleIssue[] };

/**
 * Independent of participants, turns, boards and known solutions. Encodings
 * are durable game-owned strings, following the existing position/action
 * convention. Every method handles untrusted input, including saved states.
 */
export type PuzzleRules = {
  readonly validateDefinition: (definition: string) => PuzzleValidation;
  readonly initial: (definition: string) => PuzzleChange;
  readonly validateState: (
    definition: string,
    state: string
  ) => PuzzleValidation;
  readonly apply: (
    definition: string,
    state: string,
    action: string
  ) => PuzzleChange;
  readonly complete: (definition: string, state: string) => boolean;
};

export type PuzzleSolution =
  | {
      readonly status: 'solved';
      readonly state: string;
      readonly uniqueness: 'unique' | 'multiple' | 'unknown';
    }
  | { readonly status: 'unsolvable' | 'inconclusive' }
  | { readonly status: 'invalid'; readonly issues: readonly PuzzleIssue[] };

/** Optional search: a bounded search may decline without claiming impossibility. */
export type PuzzleSolver = {
  readonly solve: (definition: string) => PuzzleSolution;
};

export type PuzzleStatistics = Readonly<
  Record<string, number | string | boolean>
>;

/** Accepted actions only: anything longer is refused before any replay. */
export const PUZZLE_EVIDENCE_ACTION_LIMIT = 10_000;

/**
 * Formed only by replaying `actions` from `rules.initial` through
 * `rules.apply` against one exact definition. A caller never supplies the
 * `state`: it is where that replay ended, under the current rules.
 */
export type PuzzleEvidence = {
  readonly actions: readonly string[];
  readonly state: string;
};

export type PuzzleReplay =
  | { readonly valid: true; readonly evidence: PuzzleEvidence }
  | { readonly valid: false; readonly issues: readonly PuzzleIssue[] };

export function replayPuzzleEvidence(
  rules: PuzzleRules,
  definition: string,
  actions: readonly string[]
): PuzzleReplay {
  if (actions.length > PUZZLE_EVIDENCE_ACTION_LIMIT)
    return {
      valid: false,
      issues: [
        {
          code: 'PUZZLE_EVIDENCE_TOO_LONG',
          message:
            'This record has too many moves. Complete a shorter playtest.',
        },
      ],
    };
  let change = rules.initial(definition);
  for (const action of actions) {
    if (!change.accepted) break;
    change = rules.apply(definition, change.state, action);
  }
  return change.accepted
    ? { valid: true, evidence: { actions, state: change.state } }
    : { valid: false, issues: change.issues };
}

/** One immutable puzzle edition that ships with the game rather than an author. */
export type BundledPuzzle = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly difficulty: string;
  readonly definition: string;
  /** Accepted actions that complete it; checked at registration. */
  readonly witness: readonly string[];
};

/** An ordered pack edition that ships with the game, available to everyone offline. */
export type BundledPuzzlePack = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly puzzles: readonly BundledPuzzle[];
};

/**
 * Content capabilities compose alongside a turn game's capabilities, or stand
 * alone. The shared platform owns drafts, immutable revisions, packs, attempts
 * and progression. Games supply only their rules and optional computations.
 */
export type PuzzleContent = {
  readonly rules: PuzzleRules;
  /**
   * A positive integer. Raise it when a change would make an already
   * published edition play differently: editions keep the version they were
   * published under and are not played under another one.
   */
  readonly rulesVersion: number;
  /** Shared state-snapshot history is appropriate for this game's actions. */
  readonly history?: 'snapshots';
  readonly solver?: PuzzleSolver;
  /**
   * Decides publication of a structurally valid definition. `evidence`, when
   * present, is a completed replay of an author's playtest of exactly this
   * definition under the current rules. Without this hook any completed
   * evidence must be complete and none is required.
   */
  readonly validatePublication?: (
    definition: string,
    evidence?: PuzzleEvidence
  ) => PuzzleValidation;
  readonly statistics?: (definition: string, state: string) => PuzzleStatistics;
  readonly bundledPacks?: readonly BundledPuzzlePack[];
  /** Original puzzles published once by the platform at database preparation. */
  readonly starter?: BundledPuzzlePack;
};

function assertBundledPacks(id: string, content: PuzzleContent): void {
  const ids = new Set<string>();
  const claim = (entry: string): void => {
    if (ids.has(entry))
      throw new Error(`${id}: bundled content id ${entry} is used twice`);
    ids.add(entry);
  };
  for (const pack of content.bundledPacks ?? []) {
    claim(pack.id);
    if (pack.puzzles.length === 0)
      throw new Error(`${id}: bundled pack ${pack.id} has no puzzles`);
    for (const puzzle of pack.puzzles) {
      claim(puzzle.id);
      const replay = replayPuzzleEvidence(
        content.rules,
        puzzle.definition,
        puzzle.witness
      );
      if (
        !replay.valid ||
        !content.rules.complete(puzzle.definition, replay.evidence.state)
      )
        throw new Error(
          `${id}: bundled puzzle ${puzzle.id} needs a witness that completes it`
        );
    }
  }
}

/** Reject missing advertised implementations at registration, before a player opens. */
export function assertPuzzleContent(id: string, content: PuzzleContent): void {
  const methods: Readonly<Record<string, unknown>> = {
    'rules.validateDefinition': content.rules?.validateDefinition,
    'rules.initial': content.rules?.initial,
    'rules.validateState': content.rules?.validateState,
    'rules.apply': content.rules?.apply,
    'rules.complete': content.rules?.complete,
    ...(content.solver === undefined
      ? {}
      : { 'solver.solve': content.solver?.solve }),
    ...(content.validatePublication === undefined
      ? {}
      : { validatePublication: content.validatePublication }),
    ...(content.statistics === undefined
      ? {}
      : { statistics: content.statistics }),
  };
  for (const [name, implementation] of Object.entries(methods))
    if (typeof implementation !== 'function')
      throw new Error(`${id}: puzzle content needs ${name}`);
  if (content.history !== undefined && content.history !== 'snapshots')
    throw new Error(`${id}: puzzle history must use snapshots`);
  if (!Number.isInteger(content.rulesVersion) || content.rulesVersion < 1)
    throw new Error(`${id}: puzzle rulesVersion must be a positive integer`);
  assertBundledPacks(id, content);
  assertStarterContent(id, content);
}

/** Published starter entries have stable ids and the game's publication check. */
function assertStarterContent(id: string, content: PuzzleContent): void {
  const starter = content.starter;
  if (starter === undefined) return;
  if (content.validatePublication === undefined)
    throw new Error(
      `${id}: starter puzzles need validatePublication to prove them`
    );
  const slug = /^[a-z][a-z0-9-]{0,63}$/;
  const ids = [starter.id, ...starter.puzzles.map((puzzle) => puzzle.id)];
  if (starter.puzzles.length === 0 || ids.some((each) => !slug.test(each)))
    throw new Error(`${id}: starter content names a pack and puzzles by slug`);
  if (new Set(ids).size !== ids.length)
    throw new Error(`${id}: starter content names each pack and puzzle once`);
}
