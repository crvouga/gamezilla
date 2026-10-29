import { describe, expect, test } from 'bun:test';

import {
  convertPath,
  convertSegment,
  findNamingViolations,
  toKebab,
  toScreaming,
} from '../naming/naming-rules';
import { mapPath, planRenames } from '../naming/rename-plan';
import {
  buildRewriteContext,
  rewriteReferences,
} from '../naming/rewrite-references';
import {
  rulesFromManifests,
  rulesFromTsconfigPaths,
} from '../naming/workspace-resolver';

describe('naming rules', () => {
  test.each([
    ['src/foo-bar.ts', true],
    ['src/foo-bar.test.ts', true],
    ['src/assets.d.ts', true],
    ['src/foo.harness.test.ts', true],
    ['img/icon@2x.png', true],
    ['.github/workflows/verify-pr.yml', true],
    ['.gitignore', true],
    ['.env.local', true],
    ['docs/GOAL.md', true],
    ['pkgs/x/README.md', true],
    ['.agents/commands/git-sync.md', true],
    ['libs/pubsub-shared-ts/emqx-deploy/Dockerfile', true],
    ['.superset/attachments/Design Shot.png', true],
    ['src/fooBar.ts', false],
    ['src/foo_bar.ts', false],
    ['src/Foo.ts', false],
    ['src/foo.TS', false],
    ['src/_internal/a.ts', false],
    ['docs/goal.md', false],
    ['docs/Low-End.md', false],
    ['.agents/commands/PR_READY.md', false],
    ['sounds/marimba a3 80.m4a', false],
    // Native ecosystem names (docs/POLYGLOT.md).
    ['pkgs/clock-shared-swift/Package.swift', true],
    ['pkgs/clock-shared-swift/Package.resolved', true],
    ['apps/a-swift/Info.plist', true],
    ['apps/a-swift/apple-client.xcodeproj/project.pbxproj', true],
    ['apps/a-swift/assets.xcassets/app-icon.appiconset/Contents.json', true],
    ['apps/a-swift/src/root-view.swift', true],
    ['apps/a-swift/AppleClient.xcodeproj/project.pbxproj', false],
    ['apps/a-swift/src/RootView.swift', false],
    ['apps/a-swift/src/Contents.json', false],
    ['apps/a-swift/src/my.xcodeproj.d/a.ts', false],
  ])('%s → ok=%p', (path, ok) => {
    expect(findNamingViolations([path]).length === 0).toBe(ok);
  });

  test('converters', () => {
    expect(toKebab('impactBell_heavy_000')).toBe('impact-bell-heavy-000');
    expect(toKebab('marimba a3 80')).toBe('marimba-a3-80');
    expect(toKebab('_internal')).toBe('internal');
    expect(toKebab('HTMLParser')).toBe('html-parser');
    expect(toScreaming('chess.com-puzzle-play-dialog')).toBe(
      'CHESS_COM_PUZZLE_PLAY_DIALOG'
    );
    expect(toScreaming('low-end-android-perf')).toBe('LOW_END_ANDROID_PERF');
  });

  test('segment conversion keeps extensions, dots and density suffixes', () => {
    expect(convertSegment('ui_unlock.mp3', 'file', 'a/ui_unlock.mp3')).toBe(
      'ui-unlock.mp3'
    );
    expect(convertSegment('Logo@2x.PNG', 'file', 'a/Logo@2x.PNG')).toBe(
      'logo@2x.png'
    );
    expect(convertSegment('chess.com-x.md', 'file', 'a/chess.com-x.md')).toBe(
      'CHESS_COM_X.md'
    );
    expect(convertSegment('.My_Dir', 'dir', '.My_Dir')).toBe('.my-dir');
    expect(convertPath('Audio/impactBell_heavy_000.ogg')).toBe(
      'audio/impact-bell-heavy-000.ogg'
    );
  });

  test('each directory is reported once', () => {
    const v = findNamingViolations(['a/_internal/x.ts', 'a/_internal/y.ts']);
    expect(v).toEqual([
      { path: 'a/_internal', kind: 'dir', suggested: 'internal' },
    ]);
  });

  // ~0.1 s alone, but its wall time is the machine's: under a saturated
  // `bun verify` it measured 5.2 s and tripped bun's default 5 s timeout. The
  // verdict is the CPU-time ratio below; the timeout only bounds a hang.
  const LOADED_MACHINE_TIMEOUT_MS = 60_000;

  test(
    'classifier cost stays linear in the number of paths',
    () => {
      // A wall-clock ceiling here measured the machine, not the classifier, and
      // went red whenever `bun verify` had the CPU saturated. What this guards is
      // that nothing turns the per-path work quadratic (a per-path scan of every
      // other path), so compare the per-path cost at two sizes: linear holds it
      // flat, quadratic multiplies it by the size ratio.
      //
      // The comparison has to survive a loaded machine — `bun verify` runs this
      // beside a dozen other tasks. Wall-clock time counts every moment the OS
      // gave the CPU to someone else, and even the fastest of seven interleaved
      // rounds read 11x under load. So measure this process's own CPU time, which
      // other processes cannot inflate; still interleave the sizes and keep the
      // fastest round of each. The bound is unchanged: quadratic reads ~10x.
      //
      // Process CPU time is coarse on some hosts (Windows counts it in ~15.6 ms
      // ticks), so one fast pass can read 0 ms. Repeat each size until the
      // sample spans many ticks; the per-path cost is then total over paths.
      const MIN_SAMPLE_CPU_MS = 100;
      const makePaths = (count: number): string[] =>
        Array.from(
          { length: count },
          (_, i) => `pkgs/p${i % 90}/src/d${i % 300}/file-${i}.test.ts`
        );
      const perPathMs = (count: number): number => {
        const paths = makePaths(count);
        const started = process.cpuUsage();
        let passes = 0;
        let spentMs = 0;
        while (spentMs < MIN_SAMPLE_CPU_MS) {
          findNamingViolations(paths);
          passes += 1;
          const spent = process.cpuUsage(started);
          spentMs = (spent.user + spent.system) / 1000;
        }
        return spentMs / (count * passes);
      };

      perPathMs(2_000); // warm the JIT so the first sample is not the slow one
      let small = Number.POSITIVE_INFINITY;
      let large = Number.POSITIVE_INFINITY;
      for (let round = 0; round < 7; round++) {
        small = Math.min(small, perPathMs(2_000));
        large = Math.min(large, perPathMs(20_000));
      }
      // Quadratic would be ~10x at a 10x size ratio; 4x leaves room for noise.
      expect(large / small).toBeLessThan(4);
    },
    LOADED_MACHINE_TIMEOUT_MS
  );
});

describe('rename plan', () => {
  test('expands directories and detects collisions', () => {
    const plan = planRenames([
      'a/_internal/x.ts',
      'a/_internal/y.ts',
      'a/ok.ts',
    ]);
    expect([...plan.files]).toEqual([
      ['a/_internal/x.ts', 'a/internal/x.ts'],
      ['a/_internal/y.ts', 'a/internal/y.ts'],
    ]);
    expect(plan.dirs.get('a/_internal')).toBe('a/internal');
    expect(mapPath(plan, 'a/_internal/z/deep.ts')).toBe('a/internal/z/deep.ts');
    expect(plan.collisions).toEqual([]);
    expect(
      planRenames(['a/foo_bar.ts', 'a/foo-bar.ts']).collisions.length
    ).toBe(1);
    expect(planRenames(['a/fooBar.ts', 'a/foo_bar.ts']).collisions.length).toBe(
      1
    );
  });

  test('case-only renames are allowed', () => {
    const plan = planRenames(['docs/goal.md']);
    expect(plan.files.get('docs/goal.md')).toBe('docs/GOAL.md');
    expect(plan.collisions).toEqual([]);
  });

  test('prefix scoping', () => {
    const plan = planRenames(['a/foo_bar.ts', 'b/foo_bar.ts'], ['a']);
    expect([...plan.files.keys()]).toEqual(['a/foo_bar.ts']);
  });
});

const FIXTURE: Record<string, string> = {
  'package.json': '{ "scripts": { "g": "bun run tools/verify_goal.ts" } }',
  'turbo.json': '{ "inputs": ["docs/goal.md", "pkgs/a/src/_internal/**"] }',
  'depcruise.cjs': "to: { path: '^pkgs/a/src/(shared|client)/_internal/' }",
  'tools/verify_goal.ts': "const GOAL = 'docs/goal.md';",
  'docs/goal.md': '# Goal\nSee [run](../pkgs/a/README.md).',
  'README.md': 'Read [the goal](docs/goal.md) and `docs/goal.md`.',
  'pkgs/a/package.json':
    '{ "name": "@pkgs/a", "exports": { "./shared/*": "./src/shared/*.ts" } }',
  'pkgs/a/README.md': 'Goal: [goal](../../docs/goal.md).',
  'pkgs/a/src/_internal/clock.ts':
    "import { ui } from '../assets_x';\nexport const c = 1;",
  'pkgs/a/src/_internal/index.ts':
    "export * from './clock';\nexport * from '../shared/foo_bar';",
  'pkgs/a/src/assets_x/index.ts':
    "export const ui = new URL('./ui_unlock.mp3', import.meta.url);",
  'pkgs/a/src/assets_x/ui_unlock.mp3': '',
  'pkgs/a/src/shared/foo_bar.ts': 'export const x = 1;',
  'pkgs/a/src/client/use.ts': [
    "import { c } from '../_internal/clock';",
    "import * as i from '../_internal';",
    "import { x } from '@pkgs/a/shared/foo_bar';",
    "import { y } from '@pkgs/a/shared/keep';",
    '// run._internal stays; so does prose about foo_bar.',
  ].join('\n'),
  'pkgs/a/src/shared/keep.ts': 'export const y = 1;',
};

function rewriteFixture(): {
  out: Record<string, string>;
  manual: string[];
  heuristic: string[];
} {
  const paths = Object.keys(FIXTURE);
  const plan = planRenames(paths);
  const aliases = [
    ...rulesFromTsconfigPaths({}),
    ...rulesFromManifests([
      {
        dir: 'pkgs/a',
        name: '@pkgs/a',
        exports: { './shared/*': './src/shared/*.ts' },
      },
    ]),
  ];
  const ctx = buildRewriteContext(plan, paths, aliases);
  const out: Record<string, string> = {};
  const manual: string[] = [];
  const heuristic: string[] = [];
  for (const [path, text] of Object.entries(FIXTURE)) {
    const result = rewriteReferences(ctx, path, text);
    out[mapPath(plan, path)] = result.text;
    manual.push(...result.manual.map((f) => `${f.file}:${f.token}`));
    heuristic.push(...result.heuristic.map((f) => `${f.file}:${f.token}`));
  }
  return { out, manual, heuristic };
}

describe('reference rewriting', () => {
  const { out, manual, heuristic } = rewriteFixture();

  test('relative imports (extensionless, index, dir) follow the move', () => {
    expect(out['pkgs/a/src/client/use.ts']).toContain(
      "from '../internal/clock'"
    );
    expect(out['pkgs/a/src/client/use.ts']).toContain("from '../internal'");
    expect(out['pkgs/a/src/internal/clock.ts']).toContain("from '../assets-x'");
    expect(out['pkgs/a/src/internal/index.ts']).toContain(
      "from '../shared/foo-bar'"
    );
  });

  test('workspace alias imports', () => {
    expect(out['pkgs/a/src/client/use.ts']).toContain(
      "from '@pkgs/a/shared/foo-bar'"
    );
    expect(out['pkgs/a/src/client/use.ts']).toContain(
      "from '@pkgs/a/shared/keep'"
    );
  });

  test('asset URLs, config paths, globs and scripts', () => {
    expect(out['pkgs/a/src/assets-x/index.ts']).toContain(
      "new URL('./ui-unlock.mp3'"
    );
    expect(out['turbo.json']).toBe(
      '{ "inputs": ["docs/GOAL.md", "pkgs/a/src/internal/**"] }'
    );
    expect(out['package.json']).toContain('bun run tools/verify-goal.ts');
    expect(out['tools/verify-goal.ts']).toBe("const GOAL = 'docs/GOAL.md';");
  });

  test('markdown links from and to moved docs', () => {
    expect(out['README.md']).toBe(
      'Read [the goal](docs/GOAL.md) and `docs/GOAL.md`.'
    );
    expect(out['pkgs/a/README.md']).toBe('Goal: [goal](../../docs/GOAL.md).');
    expect(out['docs/GOAL.md']).toContain('[run](../pkgs/a/README.md)');
  });

  test('regex-shaped dir references use the path-shaped heuristic and are reported', () => {
    expect(out['depcruise.cjs']).toBe(
      "to: { path: '^pkgs/a/src/(shared|client)/internal/' }"
    );
    expect(heuristic).toContain('depcruise.cjs:/_internal/');
  });

  test('bare identifiers and prose words are never touched', () => {
    expect(out['pkgs/a/src/client/use.ts']).toContain(
      'run._internal stays; so does prose about foo_bar.'
    );
    expect(manual).toEqual([]);
  });

  test('paths into an external tree that shares a renamed dir name are left alone', () => {
    const paths = ['libs/x/kenney_impact/Audio/hit.ogg', 'scripts/map.ts'];
    const ctx = buildRewriteContext(planRenames(paths), paths, []);
    const text =
      "src: 'kenney_ui/Audio/click_001.ogg', own: 'kenney_impact/Audio/hit.ogg'";
    const result = rewriteReferences(ctx, 'scripts/map.ts', text);
    expect(result.text).toBe(
      "src: 'kenney_ui/Audio/click_001.ogg', own: 'kenney-impact/audio/hit.ogg'"
    );
  });

  test('regex-escaped paths keep their escaping', () => {
    const paths = ['llm.md', '.gitleaks.toml'];
    const ctx = buildRewriteContext(planRenames(paths), paths, []);
    const text = "paths = ['''(?:^|/)llm\\.md$''']";
    expect(rewriteReferences(ctx, '.gitleaks.toml', text).text).toBe(
      "paths = ['''(?:^|/)LLM\\.md$''']"
    );
  });

  test('ambiguous path mentions are reported, not guessed', () => {
    const paths = ['a/foo_bar.ts', 'b/foo_bar.ts', 'c.md'];
    const ctx = buildRewriteContext(planRenames(paths, ['a']), paths, []);
    const result = rewriteReferences(
      ctx,
      'c.md',
      'see x/foo_bar.ts and [a](a/foo_bar.ts)'
    );
    expect(result.text).toBe('see x/foo_bar.ts and [a](a/foo-bar.ts)');
    expect(result.manual.map((f) => f.token)).toEqual(['x/foo_bar.ts']);
  });
});
