import { posix } from 'node:path';
import { BREAKPOINT_MIN_DESKTOP } from '@pkgs/ui-root-shared-ts/breakpoints';
import { viewports } from './preview-options';

type StoryEntry = {
  readonly id: string;
  readonly importPath: string;
  readonly tags?: readonly string[];
};

/** A desktop-only surface is captured only where the production wide layout exists. */
export function supportsStoryViewport(
  story: Pick<StoryEntry, 'tags'>,
  width: number
): boolean {
  return (
    !story.tags?.includes('viewport-desktop') || width >= BREAKPOINT_MIN_DESKTOP
  );
}

/** The shared responsive/theme matrix for canonical Storybook entries. */
export function visualScenarios(story: StoryEntry) {
  const [component, name] = story.id.split('--');
  if (!component || !name)
    throw new Error(`Malformed Storybook story id: ${story.id}`);
  const slice = posix.dirname(
    posix.normalize(posix.join('pkgs/ui-root-harness-ts', story.importPath))
  );
  const phone = Number.parseInt(viewports.phone.styles.width, 10);
  const desktop = Number.parseInt(viewports.desktop.styles.width, 10);
  const tablet = Number.parseInt(viewports.tablet.styles.width, 10);
  const responsive =
    /^(templates|layouts|screens)-/.test(story.id) ||
    story.tags?.includes('viewport-responsive');
  const widths = responsive ? [phone, desktop] : [phone];
  if (story.id.startsWith('layouts-appframe')) widths.push(tablet);
  return widths
    .filter((width) => supportsStoryViewport(story, width))
    .flatMap((width) =>
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
