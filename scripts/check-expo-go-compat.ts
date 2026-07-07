#!/usr/bin/env bun
/**
 * Enforce Expo Go compatibility: the app must only ship native modules that
 * are bundled into the Expo Go runtime for the installed SDK.
 *
 * Staying loadable in Expo Go (and via EAS Update / the dev client) is a
 * load-bearing property of this app — see `apps/client/eas.json` +
 * `apps/client/app.json` `updates`. Expo Go ships a *fixed* set of native
 * modules: exactly the ones listed in `expo/bundledNativeModules.json` for
 * the SDK (every `expo-*` module plus the blessed community modules —
 * `react-native-gesture-handler`, `react-native-reanimated`,
 * `@shopify/react-native-skia`, …). A dependency that contributes its own
 * native code and is NOT in that set requires a custom dev/build client and
 * will crash in Expo Go.
 *
 * `expo install --check` only validates *versions* of already-known packages;
 * it does not stop you from adding a brand-new native module. This check
 * closes that gap: it scans every runtime `dependencies` entry across the
 * workspace, detects the ones that carry native code (CocoaPods podspec,
 * Android Gradle module, or an Expo module config), and fails if any of them
 * is absent from the Expo Go bundled set.
 *
 * Deterministic + offline: reads `package.json` files + the installed
 * packages' own metadata only (no network), so it is safe to Turbo-cache.
 */
import { Glob } from 'bun';
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '..');
const BUNDLED_NATIVE_MODULES = join(
  REPO_ROOT,
  'node_modules',
  'expo',
  'bundledNativeModules.json'
);

/** Workspace scopes are first-party and never bundle third-party native code. */
const WORKSPACE_SCOPES = ['@apps/', '@libs/', '@pkgs/'] as const;

/**
 * Core packages that ARE the Expo Go runtime but are not listed as keys in
 * `bundledNativeModules.json` (that manifest enumerates the modules *around*
 * expo, not the `expo` package itself).
 */
const CORE_EXPO_GO_PACKAGES = ['expo'] as const;

/**
 * Native-module packages that remain loadable in Expo Go via a JS-only path
 * (browser OAuth through bundled modules like `expo-web-browser`). Clerk
 * documents this as the JavaScript integration — native UI / native OAuth
 * require a dev build, but `@pkgs/auth-clerk` uses `useSSO` + web browser only.
 *
 * Do not add packages here that hard-require their native module at import.
 */
const EXPO_GO_JS_NATIVE_ALLOWLIST = ['@clerk/expo'] as const;

function isWorkspacePackage(name: string): boolean {
  return WORKSPACE_SCOPES.some((scope) => name.startsWith(scope));
}

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

function loadExpoGoAllowedSet(): ReadonlySet<string> {
  if (!existsSync(BUNDLED_NATIVE_MODULES)) {
    console.error(
      `check:expo-go-compat: ${relative(REPO_ROOT, BUNDLED_NATIVE_MODULES)} not found — run \`bun install\` first.`
    );
    process.exit(1);
  }
  return new Set([
    ...Object.keys(readJson(BUNDLED_NATIVE_MODULES)),
    ...CORE_EXPO_GO_PACKAGES,
    ...EXPO_GO_JS_NATIVE_ALLOWLIST,
  ]);
}

function discoverPackageJsonPaths(): string[] {
  const paths = [join(REPO_ROOT, 'package.json')];
  for (const tier of ['apps', 'libs', 'pkgs'] as const) {
    const glob = new Glob(`${tier}/*/package.json`);
    for (const rel of glob.scanSync({ cwd: REPO_ROOT, absolute: false })) {
      paths.push(join(REPO_ROOT, rel));
    }
  }
  return paths;
}

/**
 * Every third-party runtime dependency declared anywhere in the repo, mapped
 * to the directory of the `package.json` that declares it. Bun installs with
 * isolated `node_modules`, so a dependency is resolvable from its declaring
 * package's directory (e.g. `apps/client/node_modules/<name>`), not
 * necessarily from the repo root.
 */
function collectRuntimeDependencies(): ReadonlyMap<string, string> {
  const byName = new Map<string, string>();
  for (const pkgPath of discoverPackageJsonPaths()) {
    const deps = readJson(pkgPath)['dependencies'];
    if (deps === null || typeof deps !== 'object') continue;
    const fromDir = dirname(pkgPath);
    for (const name of Object.keys(deps as Record<string, unknown>)) {
      if (!isWorkspacePackage(name) && !byName.has(name)) {
        byName.set(name, fromDir);
      }
    }
  }
  return byName;
}

/**
 * Resolve an installed package's root dir by walking node_modules up from the
 * declaring package's directory (Node resolution order). Returns null if not
 * installed/resolvable.
 */
function resolvePackageDir(name: string, fromDir: string): string | null {
  let dir = fromDir;
  for (;;) {
    const candidate = join(dir, 'node_modules', name, 'package.json');
    if (existsSync(candidate)) return dirname(realpathSync(candidate));
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** A package carries native code Expo Go would need linked if any holds. */
function hasNativeCode(pkgDir: string): boolean {
  if (existsSync(join(pkgDir, 'expo-module.config.json'))) return true;
  if (existsSync(join(pkgDir, 'android', 'build.gradle'))) return true;
  if (existsSync(join(pkgDir, 'android', 'build.gradle.kts'))) return true;
  try {
    if (readdirSync(pkgDir).some((entry) => entry.endsWith('.podspec'))) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function main(): void {
  const allowed = loadExpoGoAllowedSet();
  const offenders: string[] = [];
  let nativeChecked = 0;

  for (const [name, fromDir] of collectRuntimeDependencies()) {
    const pkgDir = resolvePackageDir(name, fromDir);
    if (pkgDir === null) continue;
    if (!hasNativeCode(pkgDir)) continue;
    nativeChecked += 1;
    if (!allowed.has(name)) offenders.push(name);
  }

  if (offenders.length > 0) {
    console.error(
      'check:expo-go-compat FAILED — these dependencies ship native code that\n' +
        'is NOT bundled in Expo Go, so the app can no longer run in Expo Go:\n'
    );
    for (const name of offenders.sort()) {
      console.error(`  ${name}`);
    }
    console.error(
      '\nExpo Go compatibility is a required property of this app. Either:\n' +
        '  - replace the dependency with an Expo SDK module (see\n' +
        '    node_modules/expo/bundledNativeModules.json for the allowed set), or\n' +
        '  - use a JS-only / web-compatible alternative.\n' +
        'Adding a custom native module would force a dev/build client and break\n' +
        'Expo Go + the EAS Update OTA path. Learn more:\n' +
        '  https://docs.expo.dev/workflow/customizing/'
    );
    process.exit(1);
  }

  console.log(
    `check:expo-go-compat OK — every native dependency is bundled in Expo Go ` +
      `(${allowed.size} modules in the Expo Go set, ${nativeChecked} native deps verified).`
  );
}

main();
