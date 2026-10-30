import { posix } from 'node:path';

/** The shared responsive/theme matrix for canonical Storybook entries. */
export function visualScenarios(story: { id: string; importPath: string }) {
  const [component, name] = story.id.split('--');
  if (!component || !name)
    throw new Error(`Malformed Storybook story id: ${story.id}`);
  const slice = posix.dirname(
    posix.normalize(posix.join('pkgs/ui-root-harness-ts', story.importPath))
  );
  const widths = /^(templates|layouts)-/.test(story.id) ? [390, 1440] : [390];
  if (story.id.startsWith('layouts-appframe')) widths.push(768);
  return widths.flatMap((width) =>
    ['light', 'dark'].map((theme) => {
      const suffix = width === 390 ? '' : `-${width}`;
      return {
        width,
        theme,
        suffix,
        baseline: `${slice}/baselines/chromium/${component}/${name}-${theme}${suffix}.png`,
      };
    })
  );
}
