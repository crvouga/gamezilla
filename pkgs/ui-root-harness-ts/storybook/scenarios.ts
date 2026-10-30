import { posix } from 'node:path';
import { viewports } from './preview-options';

/** The shared responsive/theme matrix for canonical Storybook entries. */
export function visualScenarios(story: { id: string; importPath: string }) {
  const [component, name] = story.id.split('--');
  if (!component || !name)
    throw new Error(`Malformed Storybook story id: ${story.id}`);
  const slice = posix.dirname(
    posix.normalize(posix.join('pkgs/ui-root-harness-ts', story.importPath))
  );
  const phone = Number.parseInt(viewports.phone.styles.width, 10);
  const desktop = Number.parseInt(viewports.desktop.styles.width, 10);
  const tablet = Number.parseInt(viewports.tablet.styles.width, 10);
  const widths = /^(templates|layouts)-/.test(story.id)
    ? [phone, desktop]
    : [phone];
  if (story.id.startsWith('layouts-appframe')) widths.push(tablet);
  return widths.flatMap((width) =>
    ['light', 'dark'].map((theme) => {
      const suffix = width === 390 ? '' : `-${width}`;
      return {
        width,
        theme,
        suffix,
        // Preserve the established screenshot height while sharing native widths.
        height: Number.parseInt(viewports.phone.styles.height, 10),
        baseline: `${slice}/baselines/chromium/${component}/${name}-${theme}${suffix}.png`,
      };
    })
  );
}
