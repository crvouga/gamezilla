/**
 * Whether `pathname` belongs to the tab rooted at `href`, or to one of the
 * other route prefixes that tab stands for (pure).
 */
export function isAppTabActive(
  href: string,
  pathname: string,
  alsoActiveUnder: readonly string[] = []
): boolean {
  const under = (root: string): boolean =>
    pathname === root || pathname.startsWith(`${root}/`);
  if (alsoActiveUnder.some(under)) return true;
  if (href === '/') {
    return pathname === '/' || pathname === '';
  }
  return under(href);
}
