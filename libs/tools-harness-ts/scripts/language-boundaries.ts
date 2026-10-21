/**
 * Language and native-manifest boundaries, run by `package-boundaries.ts`
 * inside each package's cached `lint`. Pure over manifests and file texts.
 *
 * - **Language.** `"language"` is a registered id (`languages.ts`) whose
 *   toolchain is supported. That the name spells it is the name gate's
 *   (`package-names.ts`).
 * - **Platforms.** Native languages declare `"platforms"` (`package-hosts.ts`);
 *   a package builds only for platforms every production dependency builds
 *   for.
 * - **Dependencies.** A production dependency is in the same language or is
 *   language-neutral, and a neutral package depends only on neutral ones:
 *   implementations in different languages stay independent and meet only
 *   through neutral contracts. Tooling (`devDependencies`) may cross. Tiers
 *   hold for every language: `pkgs` depend only on `pkgs`, nothing on `apps`.
 * - **Native graph.** `Package.swift` and an Xcode project's local package
 *   references name exactly the Swift workspace packages `package.json`
 *   depends on, and a remote dependency has its `Package.resolved` committed.
 * - **Native sources.** Source stays flat in `src/`; a package that builds
 *   for Linux imports no Apple-only framework, and isomorphic Swift imports no
 *   UI framework.
 */
import {
  isDeclaredLanguage,
  isLanguage,
  isSourceOf,
  LANGUAGES,
  type Language,
  NEUTRAL,
} from './languages';
import { isPlatform } from './package-hosts';

export type LanguageManifest = {
  readonly name?: string;
  readonly category?: string;
  readonly language?: string;
  readonly platforms?: unknown;
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
};

type Workspace = ReadonlyMap<string, LanguageManifest>;

const TIER = /^@(apps|libs|pkgs)\//;

function workspaceDeps(
  manifest: LanguageManifest,
  field: 'dependencies' | 'devDependencies'
): readonly string[] {
  return Object.entries(manifest[field] ?? {})
    .filter(
      ([dep, version]) => version.startsWith('workspace:') && TIER.test(dep)
    )
    .map(([dep]) => dep);
}

function platformsOf(manifest: LanguageManifest): readonly string[] | null {
  return Array.isArray(manifest.platforms)
    ? manifest.platforms.filter((p): p is string => typeof p === 'string')
    : null;
}

function platformViolations(
  manifest: LanguageManifest,
  language: string,
  workspace: Workspace
): readonly string[] {
  const out: string[] = [];
  const platforms = platformsOf(manifest);
  const needs =
    language !== NEUTRAL && LANGUAGES[language as Language].declaresPlatforms;
  if (platforms === null)
    return needs
      ? [`${language} packages declare "platforms" (package-hosts.ts)`]
      : [];
  if (platforms.length === 0) out.push('"platforms" is empty');
  for (const platform of platforms)
    if (!isPlatform(platform))
      out.push(
        `"platforms" names ${platform}, which package-hosts.ts does not know`
      );
  for (const dep of workspaceDeps(manifest, 'dependencies')) {
    const theirs = platformsOf(workspace.get(dep) ?? {});
    if (theirs === null) continue;
    const missing = platforms.filter((p) => !theirs.includes(p));
    if (missing.length > 0)
      out.push(
        `builds for ${missing.join(', ')}, which its dependency ${dep} does not (${theirs.join(', ')})`
      );
  }
  return out;
}

function dependencyViolations(
  manifest: LanguageManifest,
  language: string,
  tier: string,
  workspace: Workspace
): readonly string[] {
  const out: string[] = [];
  for (const field of ['dependencies', 'devDependencies'] as const)
    for (const dep of workspaceDeps(manifest, field)) {
      const depTier = TIER.exec(dep)?.[1];
      if (depTier === 'apps' && tier !== 'apps')
        out.push(
          `${field} names the app ${dep}: nothing outside apps/ depends on an app`
        );
      if (tier === 'pkgs' && depTier === 'libs')
        out.push(`${field} names ${dep}: pkgs/ depend only on pkgs/`);
    }
  for (const dep of workspaceDeps(manifest, 'dependencies')) {
    const theirs = workspace.get(dep)?.language;
    if (theirs === undefined || theirs === language || theirs === NEUTRAL)
      continue;
    out.push(
      language === NEUTRAL
        ? `a language-neutral package depends on the ${theirs} package ${dep}; neutral contracts depend only on neutral ones`
        : `${language} package depends on the ${theirs} package ${dep}: implementations meet only through language-neutral packages`
    );
  }
  return out;
}

/** The language rules for one manifest. */
export function languageViolations(
  manifest: LanguageManifest,
  options: {
    readonly tier: string;
    readonly workspace: Workspace;
  }
): readonly string[] {
  const language = manifest.language;
  if (!isDeclaredLanguage(language))
    return [
      `package.json declares no language (one of ${[...Object.keys(LANGUAGES), NEUTRAL].join(', ')}; languages.ts)`,
    ];
  if (language !== NEUTRAL && !LANGUAGES[language].supported)
    return [
      `${language} is reserved, not supported yet: register its toolchain first (docs/POLYGLOT.md#adding-a-language)`,
    ];
  return [
    ...platformViolations(manifest, language, options.workspace),
    ...dependencyViolations(
      manifest,
      language,
      options.tier,
      options.workspace
    ),
  ];
}

/** Frameworks that exist only on Apple platforms. */
const APPLE_ONLY =
  /^(SwiftUI|UIKit|AppKit|WatchKit|Cocoa|Combine|CoreData|SwiftData|CoreGraphics|QuartzCore|WidgetKit|XCUIAutomation)$/;
/** Frameworks that draw. */
const UI_FRAMEWORK = /^(SwiftUI|UIKit|AppKit|WatchKit|Cocoa)$/;

export type NativeFiles = {
  /** Repo-relative path of the package, e.g. `apps/apple-client-swift`. */
  readonly dir: string;
  /** Package-relative paths of the package's tracked files. */
  readonly files: readonly string[];
  readonly read: (path: string) => string;
  /** Workspace package names by repo-relative directory. */
  readonly packagesByDir: ReadonlyMap<string, string>;
};

/** `a/b/../c` → `a/c`. */
function normalize(path: string): string {
  const out: string[] = [];
  for (const part of path.split('/'))
    if (part === '..') out.pop();
    else if (part !== '.' && part !== '') out.push(part);
  return out.join('/');
}

/** Local package paths and whether any remote package is referenced. */
function nativeReferences(native: NativeFiles): {
  readonly local: readonly { readonly file: string; readonly path: string }[];
  readonly remote: readonly string[];
} {
  const local: { file: string; path: string }[] = [];
  const remote: string[] = [];
  for (const file of native.files) {
    if (file === 'Package.swift') {
      const text = native.read(file);
      for (const match of text.matchAll(
        /\.package\(\s*(?:name:\s*"[^"]*",\s*)?path:\s*"([^"]+)"/g
      ))
        local.push({ file, path: match[1] ?? '' });
      if (/\.package\(\s*(?:name:\s*"[^"]*",\s*)?url:/.test(text))
        remote.push(file);
    }
    if (/^[^/]+\.xcodeproj\/project\.pbxproj$/.test(file)) {
      const text = native.read(file);
      for (const match of text.matchAll(
        /isa = XCLocalSwiftPackageReference;\s*relativePath = "?([^";]+)"?;/g
      ))
        local.push({ file, path: match[1] ?? '' });
      if (text.includes('isa = XCRemoteSwiftPackageReference;'))
        remote.push(file);
    }
  }
  return { local, remote };
}

function resolvedFileFor(file: string): string {
  return file === 'Package.swift'
    ? 'Package.resolved'
    : file.replace(
        /project\.pbxproj$/,
        'project.xcworkspace/xcshareddata/swiftpm/Package.resolved'
      );
}

/** The native dependency graph agrees with `package.json`. */
export function nativeGraphViolations(
  manifest: LanguageManifest,
  native: NativeFiles
): readonly string[] {
  if (manifest.language !== 'swift') return [];
  const out: string[] = [];
  const hasManifest = native.files.some(
    (file) =>
      file === 'Package.swift' ||
      /^[^/]+\.xcodeproj\/project\.pbxproj$/.test(file)
  );
  if (!hasManifest)
    out.push(
      'a Swift package has a Package.swift or one .xcodeproj at its root'
    );
  const { local, remote } = nativeReferences(native);
  const declared = new Set(workspaceDeps(manifest, 'dependencies'));
  const referenced = new Set<string>();
  for (const reference of local) {
    const target = normalize(`${native.dir}/${reference.path}`);
    const dep = native.packagesByDir.get(target);
    if (dep === undefined) {
      out.push(
        `${reference.file} references ${reference.path}, which is not a workspace package`
      );
      continue;
    }
    referenced.add(dep);
    if (!declared.has(dep))
      out.push(
        `${reference.file} depends on ${dep}; declare it in package.json "dependencies" so Turborepo's graph has the edge`
      );
  }
  for (const dep of declared)
    if (!referenced.has(dep))
      out.push(
        `package.json depends on ${dep}, which no Package.swift or Xcode project references`
      );
  for (const file of remote)
    if (!native.files.includes(resolvedFileFor(file)))
      out.push(
        `${file} has remote packages; commit ${resolvedFileFor(file)} so every build resolves the same versions`
      );
  return out;
}

/** Native source layout and the frameworks it may import. */
export function nativeSourceViolations(
  manifest: LanguageManifest,
  native: NativeFiles
): readonly string[] {
  const language = manifest.language;
  if (!isLanguage(language) || language === 'typescript') return [];
  const out: string[] = [];
  const platforms = platformsOf(manifest) ?? [];
  for (const file of native.files) {
    if (!isSourceOf(language, file)) continue;
    if (file.startsWith('src/') && file.slice(4).includes('/'))
      out.push(
        `${file}: src must be flat; split a vertical slice into its own package`
      );
    if (language !== 'swift' || !file.startsWith('src/')) continue;
    for (const match of native
      .read(file)
      .matchAll(
        /^\s*(?:@\w+\s+)*import\s+(?:(?:struct|class|enum|protocol|func|var|let|typealias)\s+)?(\w+)/gm
      )) {
      const module = match[1] ?? '';
      if (platforms.includes('linux') && APPLE_ONLY.test(module))
        out.push(`${file} imports ${module}, which does not exist on Linux`);
      else if (manifest.category === 'isomorphic' && UI_FRAMEWORK.test(module))
        out.push(`${file} imports ${module}: isomorphic code draws nothing`);
    }
  }
  return out;
}
