import { expect, test } from 'bun:test';
import { readdirSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import ts from 'typescript';

const root = join(import.meta.dirname, '../../..');
const ambientSources = new Set([
  join(root, 'pkgs/ts-reset-shared-ts/src/ts-reset.ts'),
  join(root, 'pkgs/ui-root-client-ts/src/lingui-augmentation.ts'),
]);

function nearestProject(source: string): string | undefined {
  return ts.findConfigFile(dirname(join(root, source)), ts.sys.fileExists);
}

// regression: storybook-docgen-loads-repository-project
test('Pong board metadata uses its source project instead of every repository test', () => {
  expect(nearestProject('libs/pong-client-ts/src/pong-board.tsx')).toBe(
    join(root, 'libs/tsconfig.json')
  );
});

test('every story owner scopes metadata roots to production sources and declarations', () => {
  for (const tier of ['libs', 'pkgs']) {
    for (const name of readdirSync(join(root, tier))) {
      if (!name.endsWith('-client-ts')) continue;
      const source = join(root, tier, name, 'src');
      if (!ts.sys.directoryExists(source)) continue;
      const stories = ts.sys.readDirectory(
        source,
        ['.tsx'],
        [],
        ['**/*.stories.tsx']
      );
      const firstStory = stories[0];
      if (!firstStory) continue;
      const project = ts.findConfigFile(source, ts.sys.fileExists);
      expect(project).toBe(
        tier === 'libs'
          ? join(root, 'libs/tsconfig.json')
          : join(source, 'tsconfig.json')
      );
      if (!project) throw new Error(`Missing metadata project: ${source}`);
      const config = ts.readConfigFile(project, ts.sys.readFile);
      expect(config.error).toBeUndefined();
      const parsed = ts.parseJsonConfigFileContent(
        config.config,
        ts.sys,
        dirname(project)
      );
      expect(parsed.errors).toEqual([]);
      expect(parsed.fileNames).toContain(firstStory);
      const unrelated = parsed.fileNames.filter(
        (file) =>
          !(tier === 'libs'
            ? /-client-ts[\\/]src[\\/]/.test(file)
            : file.startsWith(`${source}${sep}`)) &&
          !file.endsWith('.d.ts') &&
          !ambientSources.has(file)
      );
      expect(unrelated).toEqual([]);
    }
  }
});
