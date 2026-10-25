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

/** One original puzzle a game ships, proven solvable by its witness. */
export type StarterPuzzle = {
  /** Stable within the game: its published identity never changes. */
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly difficulty: string;
  readonly definition: string;
  /** A completed state the game's publication check accepts for `definition`. */
  readonly witness: string;
};

/**
 * Original content a game ships: its puzzles, published once as immutable
 * first editions and gathered in one pack, each re-proven by its witness
 * against the game's own rules before it is written.
 */
export type StarterContent = {
  readonly pack: {
    readonly id: string;
    readonly title: string;
    readonly description: string;
  };
  readonly puzzles: readonly StarterPuzzle[];
};

/**
 * Content capabilities compose alongside a turn game's capabilities, or stand
 * alone. The shared platform owns drafts, immutable revisions, packs, attempts
 * and progression. Games supply only their rules and optional computations.
 */
export type PuzzleContent = {
  readonly rules: PuzzleRules;
  /** Shared state-snapshot history is appropriate for this game's actions. */
  readonly history?: 'snapshots';
  readonly solver?: PuzzleSolver;
  /** A completed playtest can prove solvability without an exhaustive search. */
  readonly validatePublication?: (
    definition: string,
    solution?: string
  ) => PuzzleValidation;
  readonly statistics?: (definition: string, state: string) => PuzzleStatistics;
  /** Original puzzles the game ships, in one pack (each with its witness). */
  readonly starter?: StarterContent;
};

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
  assertStarterContent(id, content);
}

/** Starter puzzles name distinct slugs and a witness, and need a publication check. */
function assertStarterContent(id: string, content: PuzzleContent): void {
  const starter = content.starter;
  if (starter === undefined) return;
  if (content.validatePublication === undefined)
    throw new Error(
      `${id}: starter puzzles need validatePublication to prove them`
    );
  const slug = /^[a-z][a-z0-9-]{0,63}$/;
  const ids = [starter.pack.id, ...starter.puzzles.map((puzzle) => puzzle.id)];
  if (starter.puzzles.length === 0 || ids.some((each) => !slug.test(each)))
    throw new Error(`${id}: starter content names a pack and puzzles by slug`);
  if (new Set(ids).size !== ids.length)
    throw new Error(`${id}: starter content names each pack and puzzle once`);
}
