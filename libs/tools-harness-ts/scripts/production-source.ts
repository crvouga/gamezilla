/** Files a production consumer can observe, excluding colocated verification artifacts. */
export function isProductionSource(path: string): boolean {
  const normalized = path.replaceAll('\\', '/');
  return (
    !/\.(test|stories|example)\.[cm]?[jt]sx?$/.test(normalized) &&
    !normalized.includes('/baselines/') &&
    !normalized.includes('/storybook/')
  );
}
