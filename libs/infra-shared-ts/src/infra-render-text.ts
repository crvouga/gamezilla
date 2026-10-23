/** Escaping and small text helpers for the generated page. */

const ENTITIES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ENTITIES[c] ?? c);
}

/** A lowercase DOM-id fragment. */
export function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** Ids shared by the sections and the graphs that link to them. */
export function moduleAnchor(
  env: string | null,
  stack: string,
  module: string
): string {
  return `m-${slug(env ?? 'global')}-${slug(stack)}-${slug(module || 'root')}`;
}

export function stackAnchor(env: string | null, stack: string): string {
  return `s-${slug(env ?? 'global')}-${slug(stack)}`;
}

export function resourceAnchor(
  env: string | null,
  stack: string,
  address: string
): string {
  return `r-${slug(env ?? 'global')}-${slug(stack)}-${slug(address)}`;
}

/** Escape text, then turn `backtick` spans into <code>. */
export function inlineCode(value: string): string {
  return esc(value).replace(/`([^`]+)`/g, '<code>$1</code>');
}
