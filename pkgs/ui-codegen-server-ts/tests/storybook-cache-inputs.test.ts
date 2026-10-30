import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';

const root = join(import.meta.dirname, '../../..');

test('Storybook tasks hash every discovered story owner', () => {
  const tasks = [
    ['pkgs/ui-root-harness-ts/turbo.json', 'storybook:build'],
    ['pkgs/ui-codegen-server-ts/turbo.json', 'inventory'],
  ] as const;
  const stories = [
    ...new Bun.Glob('pkgs/*-client-ts/src/**/*.stories.tsx').scanSync({
      cwd: root,
    }),
  ].map(slashPath);
  for (const [file, name] of tasks) {
    const config = JSON.parse(readFileSync(join(root, file), 'utf8')) as {
      tasks: Record<string, { inputs: string[] }>;
    };
    const globs = config.tasks[name]!.inputs.filter((input) =>
      input.startsWith('$TURBO_ROOT$/')
    ).map((input) => new Bun.Glob(input.slice('$TURBO_ROOT$/'.length)));
    for (const story of stories) {
      if (
        file.startsWith('pkgs/ui-root-harness-ts/') &&
        story.startsWith('pkgs/ui-root-harness-ts/')
      )
        continue;
      expect(
        globs.some((glob) => glob.match(story)),
        `${file}#${name}: name the new story owner in task inputs: ${story}`
      ).toBe(true);
    }
  }
});
