import { resolve } from 'node:path';
import { Channel } from 'storybook/internal/channels';
import { getPresets } from 'storybook/internal/common';
import { viteFinal as solidPreset } from 'storybook-solidjs-vite/preset';
import { build, loadConfigFromFile } from 'vite';
import project from '../storybook/main';

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

const preview = await previewConfig();
let pluginNames: string[] = [];
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
      configResolved(config) {
        pluginNames = config.plugins.map((plugin) => plugin.name);
      },
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
      external: (id) => id.startsWith('@') || id.startsWith('solid-js'),
    },
  },
});
const [output] = Array.isArray(result) ? result : [result];
if (!('output' in output)) throw new Error('Missing build output');
const chunk = output.output.find((file) => file.type === 'chunk');
if (!chunk) throw new Error('Missing game fact module');
process.stdout.write(JSON.stringify({ code: chunk.code, pluginNames }));
