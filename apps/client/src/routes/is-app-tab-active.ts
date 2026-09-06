/** Whether `pathname` belongs to the tab rooted at `href` (pure). */
export function isAppTabActive(href: string, pathname: string): boolean {
  if (href === '/') {
    return pathname === '/' || pathname === '';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
