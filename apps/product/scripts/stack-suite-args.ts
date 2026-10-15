/** Stack switches precede `--`; trailing arguments go to the spec runner. */
export function stackSuiteArgs(argv: readonly string[]) {
  const separator = argv.indexOf('--');
  const stack = separator < 0 ? argv : argv.slice(0, separator);
  const isSpec = (value: string) =>
    /(?:\.test\.[cm]?[jt]sx?|\.feature)$/.test(value);
  const controls = stack.filter((value) => !isSpec(value));
  const populationSpecified = controls.some(
    (value) =>
      value === '--synthetic-population-workers' ||
      value.startsWith('--synthetic-population-workers=')
  );
  return {
    // Spec fixtures own their participants; explicit worker checks can opt in.
    stack: populationSpecified
      ? controls
      : [...controls, '--synthetic-population-workers=0'],
    suite: [
      ...stack.filter(isSpec),
      ...(separator < 0 ? [] : argv.slice(separator + 1)),
    ],
  };
}
