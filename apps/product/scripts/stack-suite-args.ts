/** Stack switches precede `--`; trailing arguments go to the spec runner. */
export function stackSuiteArgs(argv: readonly string[]) {
  const separator = argv.indexOf('--');
  const stack = separator < 0 ? argv : argv.slice(0, separator);
  const isSpec = (value: string) =>
    /(?:\.test\.[cm]?[jt]sx?|\.feature)$/.test(value);
  return {
    stack: stack.filter((value) => !isSpec(value)),
    suite: [
      ...stack.filter(isSpec),
      ...(separator < 0 ? [] : argv.slice(separator + 1)),
    ],
  };
}
