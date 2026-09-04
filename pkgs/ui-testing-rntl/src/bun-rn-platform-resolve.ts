/**
 * Metro-style platform files for bun:test (`Foo.ios.js` before `Foo.js`).
 * RN's `Platform.js` re-exports `./Platform`, which must become `Platform.ios.js`.
 */
import { existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const SOURCE_EXTS = ['.js', '.jsx'] as const;

function isRnImporter(importer: string): boolean {
  const normalized = importer.replaceAll('\\', '/');
  return (
    normalized.includes('/node_modules/react-native/') ||
    normalized.includes('/node_modules/@react-native/')
  );
}

function platformCandidates(abs: string, platform: string): string[] {
  const known = SOURCE_EXTS.find((ext) => abs.endsWith(ext));
  const base = known != null ? abs.slice(0, -known.length) : abs;
  const out: string[] = [];
  for (const suffix of [`.${platform}`, '.native', '']) {
    for (const ext of SOURCE_EXTS) {
      out.push(`${base}${suffix}${ext}`);
    }
  }
  for (const suffix of [`.${platform}`, '.native', '']) {
    for (const ext of SOURCE_EXTS) {
      out.push(join(base, `index${suffix}${ext}`));
    }
  }
  return out;
}

export function resolveRnPlatformImport(
  specifier: string,
  importer: string,
  platform = 'ios'
): string | undefined {
  if (!isRnImporter(importer)) return undefined;
  if (!(specifier.startsWith('./') || specifier.startsWith('../'))) {
    return undefined;
  }
  const abs = resolve(dirname(importer), specifier);
  for (const candidate of platformCandidates(abs, platform)) {
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

export function rewriteRnPlatformSpecifiers(
  source: string,
  filePath: string
): string {
  return source.replace(
    /((?:from\s+|require\s*\(\s*))(['"])(\.\.?\/[^'"]+)\2/g,
    (match, prefix: string, quote: string, spec: string) => {
      const resolved = resolveRnPlatformImport(spec, filePath);
      if (resolved == null) return match;
      const posix = resolved.replaceAll('\\', '/');
      if (!/\.(ios|android|native)\.[^.]+$/.test(posix)) return match;
      let rel = relative(dirname(filePath), resolved).replaceAll('\\', '/');
      if (!rel.startsWith('.')) rel = `./${rel}`;
      return `${prefix}${quote}${rel}${quote}`;
    }
  );
}

export function installRnPlatformResolve(build: {
  onResolve: (
    opts: { filter: RegExp },
    cb: (args: {
      path: string;
      importer: string;
    }) => { path: string } | undefined
  ) => void;
}): void {
  build.onResolve({ filter: /^\.\.?\// }, (args) => {
    const resolved = resolveRnPlatformImport(args.path, args.importer);
    return resolved != null ? { path: resolved } : undefined;
  });
}
