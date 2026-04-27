import type { SitemapType } from 'expo-router';

const LAYOUT_CONTEXT_RE = /_layout\.[jt]sx?$/;

function titleCaseSegment(segment: string): string {
  return segment
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

/** Root tab home is the Spaces screen in this app. */
function pathnameToBrowseTitle(pathname: string): string {
  const trimmed = pathname.trim();
  const normalized =
    trimmed === '' || trimmed === '/'
      ? '/'
      : trimmed.startsWith('/')
        ? trimmed
        : `/${trimmed}`;
  if (normalized === '/') {
    return 'Spaces';
  }
  const segments = normalized.split('/').filter(Boolean);
  return segments.map(titleCaseSegment).join(' › ');
}

function titleFromContextKey(contextKey: string): string {
  const normalized = contextKey.replace(/\\/g, '/');
  const segments = normalized
    .split('/')
    .filter(Boolean)
    .filter((s) => !/^\([^)]+\)$/.test(s))
    .map((s) => s.replace(/\.(tsx?|jsx?)$/i, ''))
    .filter((s) => s !== '_layout' && s !== 'index');
  if (segments.length === 0) {
    return 'Spaces';
  }
  return segments.map(titleCaseSegment).join(' › ');
}

/**
 * Short, user-facing label for the command palette (no raw paths or filenames).
 */
export function navCommandTitle(node: SitemapType): string {
  const raw = sitemapHrefToString(node.href);
  if (raw && !raw.startsWith('{')) {
    return pathnameToBrowseTitle(raw);
  }
  return titleFromContextKey(node.contextKey);
}

export function sitemapHrefToString(href: SitemapType['href']): string {
  if (typeof href === 'string') return href;
  if (
    href &&
    typeof href === 'object' &&
    'pathname' in href &&
    typeof (href as { pathname: unknown }).pathname === 'string'
  ) {
    return (href as { pathname: string }).pathname;
  }
  return JSON.stringify(href);
}

export function collectNavigableRoutes(node: SitemapType, acc: SitemapType[]) {
  if (node.isInternal) {
    for (const child of node.children) collectNavigableRoutes(child, acc);
    return;
  }
  const isLayout =
    node.children.length > 0 || LAYOUT_CONTEXT_RE.test(node.contextKey);
  if (!isLayout) acc.push(node);
  for (const child of node.children) collectNavigableRoutes(child, acc);
}

export function dedupeNavigableRoutes(nodes: SitemapType[]) {
  const byHrefKey = new Map<string, SitemapType>();
  for (const node of nodes) {
    const key = sitemapHrefToString(node.href);
    if (!key || key.includes('[')) continue;
    if (!byHrefKey.has(key)) byHrefKey.set(key, node);
  }
  return [...byHrefKey.values()].sort((a, b) =>
    navCommandTitle(a).localeCompare(navCommandTitle(b), undefined, {
      sensitivity: 'base',
    })
  );
}
