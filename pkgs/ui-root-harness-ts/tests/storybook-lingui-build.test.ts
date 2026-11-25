import { expect, test } from 'bun:test';
import { resolve } from 'node:path';
import type { JSX } from '@solidjs/web';
import { Channel } from 'storybook/internal/channels';
import { getPresets } from 'storybook/internal/common';
import { viteFinal as solidPreset } from 'storybook-solidjs-vite/preset';
import { build, loadConfigFromFile } from 'vite';
import project from '../storybook/main';
import { renderUi } from './render';

const root = resolve(import.meta.dirname, '..');
const fixture = resolve(root, 'game-fact-label.tsx');

async function previewConfig() {
  const configDir = resolve(root, 'storybook');
  const base = await loadConfigFromFile(
    { command: 'build', mode: 'production' },
    undefined,
    root
  );
  const presets = await getPresets([resolve(configDir, 'main.ts')], {
    configDir,
  });
  const options = { configDir, presets, channel: new Channel({}) };
  if (!solidPreset || !project.viteFinal)
    throw new Error('Expected both preview presets');
  return project.viteFinal(
    await solidPreset(base?.config ?? {}, options),
    options
  );
}

// regression: storybook-lingui-macro-lowered-before-translation
test('the preview compiler links the translated Unrated game fact to the Solid runtime', async () => {
  const preview = await previewConfig();
  const result = await build({
    ...preview,
    root,
    configFile: false,
    logLevel: 'silent',
    publicDir: false,
    plugins: [
      ...(preview.plugins ?? []),
      {
        name: 'game-fact-label-fixture',
        resolveId(id) {
          return id === fixture ? id : null;
        },
        load(id) {
          if (id !== fixture) return null;
          return [
            "import { Trans } from '@pkgs/lingui-solid-client-ts/macro';",
            'const GameFact = (props) => props.label;',
            'export const unrated = () => <GameFact label={<Trans>Unrated</Trans>} />;',
          ].join('\n');
        },
      },
    ],
    build: {
      write: false,
      minify: false,
      lib: { entry: fixture, formats: ['es'] },
      rolldownOptions: {
        output: { paths: (id) => import.meta.resolve(id) },
        external: (id) => id.startsWith('@') || id.startsWith('solid-js'),
      },
    },
  });
  const [output] = Array.isArray(result) ? result : [result];
  if (!('output' in output)) throw new Error('Missing build output');
  const chunk = output.output.find((file) => file.type === 'chunk');
  if (!chunk) throw new Error('Missing game fact module');
  const built = (await import(
    `data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`
  )) as { unrated: () => JSX.Element };
  const screen = renderUi(built.unrated);
  expect(screen.getByText('Unrated')).toBeInTheDocument();
});
