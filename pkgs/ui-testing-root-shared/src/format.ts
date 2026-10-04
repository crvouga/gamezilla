/** Human-readable testId description for error messages and reports. */
export function formatTestId(testId: string): string {
  return `testId("${testId}")`;
}

/** Human-readable testId path for nested locators. */
export function formatTestIdPath(path: readonly string[]): string {
  if (path.length === 0) return 'testId(<empty>)';
  return path.map(formatTestId).join(' >> ');
}
