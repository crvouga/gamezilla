/** Run a scenario phase, then its cleanup, without losing either failure. */
export async function withScenarioCleanup<T>(
  run: () => Promise<T>,
  cleanup: () => Promise<void>
): Promise<T> {
  let outcome: { ok: true; value: T } | { ok: false; error: unknown };
  try {
    outcome = { ok: true, value: await run() };
  } catch (error) {
    outcome = { ok: false, error };
  }
  try {
    await cleanup();
  } catch (error) {
    if (outcome.ok) throw error;
    const describe = (value: unknown) =>
      value instanceof Error ? value.message : String(value);
    throw new AggregateError(
      [outcome.error, error],
      `${describe(outcome.error)}\nScenario cleanup also failed: ${describe(error)}`,
      { cause: outcome.error }
    );
  }
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}
