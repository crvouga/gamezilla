/** Execution must contain each enrolled definition once, with unique identities. */
export function executionGameProblems(
  harness: readonly { readonly shared: { readonly id: string } }[],
  games: readonly {
    readonly shared: { readonly id: string };
    readonly label: string;
  }[]
): readonly string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const labels = new Set<string>();
  for (const game of games) {
    const id = game.shared.id;
    if (ids.has(id))
      problems.push(
        `${id}: duplicate execution game id — every game must have its own evidence`
      );
    if (labels.has(game.label))
      problems.push(
        `${id}: duplicate execution game label "${game.label}" — test names must identify one game`
      );
    ids.add(id);
    labels.add(game.label);
  }
  for (const enrolled of harness) {
    const id = enrolled.shared.id;
    const execution = games.find((game) => game.shared.id === id);
    if (execution === undefined)
      problems.push(
        `${id}: HARNESS_GAMES has no execution game — enroll its HarnessGame in the shared conformance world`
      );
    else if (execution.shared !== enrolled.shared)
      problems.push(
        `${id}: execution holds another shared definition — use the HarnessGame registered in HARNESS_GAMES`
      );
  }
  return problems;
}

/** A code suite owes its own case to every eligible game, and no other game. */
export function suiteCaseProblems(
  suite: {
    readonly id: string;
    readonly registers: Readonly<Record<string, boolean>> | null;
  },
  required: readonly string[]
): readonly string[] {
  if (suite.registers === null) return [];
  const problems = required
    .filter((id) => suite.registers?.[id] !== true)
    .map(
      (id) =>
        `${suite.id} [${id}]: missing required case — register its tests inside forEveryGame`
    );
  for (const [id, registered] of Object.entries(suite.registers))
    if (registered && !required.includes(id))
      problems.push(
        `${suite.id} [${id}]: unexpected case — evidence belongs only to an eligible execution game`
      );
  return problems;
}
