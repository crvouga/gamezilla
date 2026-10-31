/**
 * Repo naming convention — pure, no I/O.
 *
 * - Markdown docs: `SCREAMING_SNAKE_CASE.md` (`README.md`).
 * - Every other file and every directory: `lower-kebab-case`, with a
 *   lowercase extension chain (`foo-bar.test.ts`, `icon@2x.png`).
 *
 * The verification (`libs/tools-harness-ts/scripts/verify-naming.ts`) and the codemod
 * (`libs/tools-harness-ts/scripts/fix-naming.ts`) share these rules so the codemod always
 * produces names the verification accepts.
 */

/** Names mandated by external tools, and trees whose names are not ours. */
export const NAMING_EXEMPT = {
  /** Exact basenames a tool requires (any directory). */
  basenames: new Set([
    'Dockerfile',
    'Caddyfile',
    'Makefile',
    'LICENSE',
    'LICENSE.txt',
    'CODEOWNERS',
    'copilot-instructions.md',
    'mcpServers', // Continue's project MCP directory.
    'components.json',
    '__snapshots__',
    '__mocks__',
    '.super.engineering',
    // SwiftPM and Xcode (docs/POLYGLOT.md).
    'Package.swift',
    'Package.resolved',
    'Info.plist',
  ]),
  /**
   * Native bundle directories: the extension is the tool's, the stem is
   * ours and stays kebab-case (`apple-client.xcodeproj`).
   */
  bundleDirExtensions: new Set([
    'xcodeproj',
    'xcworkspace',
    'xcassets',
    'appiconset',
    'colorset',
    'imageset',
    'lproj',
  ]),
  /** Basenames a tool requires only inside its own bundle directory. */
  bundleBasenames: { 'Contents.json': '.xcassets/' } as Readonly<
    Record<string, string>
  >,
  /** Path prefixes skipped entirely (tool-managed content). */
  prefixes: [
    '.superset/attachments/',
    // Third-party skill sources, kept as published.
    '.agents/skills/impeccable/',
    '.agents/skills/ui-ux-pro-max/',
    '.agents/skills/ast-grep/',
    // A portable Agent Skills directory, kept identical to its copies in
    // other repositories (kebab-case reference names, Python modules).
    '.agents/skills/ci-green/',
  ],
  /** Markdown under these prefixes is a command id, so it stays kebab-case. */
  kebabMarkdownPrefixes: [
    '.agents/commands/',
    '.claude/agents/',
    '.cursor/commands/',
    '.factory/commands/',
    '.roo/commands/',
    '.clinerules/workflows/',
    '.claude/commands/',
    '.github/prompts/',
    '.windsurf/workflows/',
  ],
} as const;

export type SegmentKind = 'dir' | 'file';

export interface NamingViolation {
  /** Repo-relative path of the offending segment (a directory or a file). */
  readonly path: string;
  readonly kind: SegmentKind;
  /** The segment name the convention wants (same directory). */
  readonly suggested: string;
}

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SCREAMING = /^[A-Z0-9]+(?:_[A-Z0-9]+)*$/;
const EXT_PART = /^[a-zA-Z0-9]+$/;
const LOWER_EXT_PART = /^[a-z0-9]+$/;
const DENSITY_SUFFIX = /@\d+x$/;

/** Split any mixed-case / snake / spaced / dotted name into lowercase words. */
export function splitWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_.\-]+/)
    .filter((w) => w.length > 0)
    .map((w) => w.toLowerCase());
}

export function toKebab(name: string): string {
  return splitWords(name).join('-');
}

export function toScreaming(name: string): string {
  return splitWords(name).join('_').toUpperCase();
}

interface FileParts {
  /** Leading `.` for dotfiles (`.gitignore`), else ''. */
  readonly dot: string;
  readonly stem: string;
  /** Pixel-density suffix kept verbatim (`@2x`), else ''. */
  readonly density: string;
  /** Extension parts after the stem (`['test', 'ts']`). */
  readonly exts: readonly string[];
}

/**
 * The extension chain is the longest run of trailing dot-parts that are plain
 * alphanumerics; everything before it is the stem (`chess.com-x.md` → stem
 * `chess.com-x`).
 */
function splitFile(name: string): FileParts {
  const dot = name.startsWith('.') ? '.' : '';
  const parts = name.slice(dot.length).split('.');
  let cut = parts.length;
  while (cut > 1 && EXT_PART.test(parts[cut - 1] ?? '')) cut -= 1;
  const rawStem = parts.slice(0, cut).join('.');
  const density = DENSITY_SUFFIX.exec(rawStem)?.[0] ?? '';
  return {
    dot,
    stem: rawStem.slice(0, rawStem.length - density.length),
    density,
    exts: parts.slice(cut),
  };
}

function isMarkdown(parts: FileParts): boolean {
  return parts.exts.at(-1)?.toLowerCase() === 'md';
}

function wantsKebabMarkdown(path: string): boolean {
  return NAMING_EXEMPT.kebabMarkdownPrefixes.some((p) => path.startsWith(p));
}

/** Convention-conforming name for one path segment (identity when it already conforms). */
export function convertSegment(
  name: string,
  kind: SegmentKind,
  path: string
): string {
  if (NAMING_EXEMPT.basenames.has(name)) return name;
  const bundle = NAMING_EXEMPT.bundleBasenames[name];
  if (bundle !== undefined && path.includes(bundle)) return name;
  if (kind === 'dir') {
    const dot = name.startsWith('.') ? '.' : '';
    const body = name.slice(dot.length);
    const extension = body.split('.').at(-1) ?? '';
    if (
      body.includes('.') &&
      NAMING_EXEMPT.bundleDirExtensions.has(extension)
    ) {
      const stem = body.slice(0, -(extension.length + 1));
      return KEBAB.test(stem) ? name : `${dot}${toKebab(stem)}.${extension}`;
    }
    return KEBAB.test(body) ? name : `${dot}${toKebab(body)}`;
  }
  const parts = splitFile(name);
  const screaming = isMarkdown(parts) && !wantsKebabMarkdown(path);
  const stemOk = screaming
    ? SCREAMING.test(parts.stem)
    : KEBAB.test(parts.stem);
  const extsOk = parts.exts.every((e) => LOWER_EXT_PART.test(e));
  if (stemOk && extsOk) return name;
  const stem = screaming ? toScreaming(parts.stem) : toKebab(parts.stem);
  const exts = parts.exts.map((e) => `.${e.toLowerCase()}`).join('');
  return `${parts.dot}${stem}${parts.density}${exts}`;
}

export function isExemptPath(path: string): boolean {
  return NAMING_EXEMPT.prefixes.some((p) => path.startsWith(p));
}

interface Segment {
  readonly name: string;
  readonly kind: SegmentKind;
  /** Repo-relative path up to and including this segment. */
  readonly path: string;
}

function segmentsOf(path: string): Segment[] {
  const names = path.split('/');
  const out: Segment[] = [];
  let prefix = '';
  for (let i = 0; i < names.length; i += 1) {
    const name = names[i] ?? '';
    prefix = prefix === '' ? name : `${prefix}/${name}`;
    out.push({
      name,
      kind: i === names.length - 1 ? 'file' : 'dir',
      path: prefix,
    });
  }
  return out;
}

/**
 * Violations across a list of repo-relative file paths. Each directory is
 * judged once no matter how many files live under it.
 */
export function findNamingViolations(
  paths: Iterable<string>
): NamingViolation[] {
  const out: NamingViolation[] = [];
  const seenDirs = new Set<string>();
  for (const path of paths) {
    if (path.length === 0 || isExemptPath(path)) continue;
    for (const seg of segmentsOf(path)) {
      if (seg.kind === 'dir') {
        if (seenDirs.has(seg.path)) continue;
        seenDirs.add(seg.path);
      }
      const suggested = convertSegment(seg.name, seg.kind, seg.path);
      if (suggested !== seg.name) {
        out.push({ path: seg.path, kind: seg.kind, suggested });
      }
    }
  }
  return out;
}

/** Full convention-conforming path (every segment converted). */
export function convertPath(path: string): string {
  if (isExemptPath(path)) return path;
  return segmentsOf(path)
    .map((seg) => convertSegment(seg.name, seg.kind, seg.path))
    .join('/');
}
