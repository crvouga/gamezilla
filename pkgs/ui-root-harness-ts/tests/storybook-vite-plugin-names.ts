import solid from '@solidjs/vite-plugin';
import config, { flattenPlugins } from '../storybook/main';

const viteFinal = config.viteFinal;
if (!viteFinal) throw new Error('Storybook has no Vite composition');
const final = await viteFinal({ plugins: [solid()] }, {} as never);
const names = flattenPlugins(final.plugins ?? []).flatMap((plugin) =>
  plugin && typeof plugin === 'object' && 'name' in plugin ? [plugin.name] : []
);
process.stdout.write(names.join('\n'));
