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

/** Storybook toolbar global name to every value a story is captured with. */
export type StoryGlobalsMatrix = Readonly<Record<string, readonly string[]>>;

const SPACE_GAMES = [
  'light-cycles',
  'chess',
  'hearts',
  'battleship',
  'word-tiles',
] as const;
const SPACE_ROLES = ['host', 'guest'] as const;

/**
 * Stories whose state comes from toolbar globals rather than separate CSF
 * exports. The Storybook index carries no parameters, so the browser suite
 * reads the matrix here; `storybook-scenarios.test.ts` keeps it equal to each
 * story's declared `parameters.spaceMatrix`.
 */
export const storyGlobalsMatrices: Readonly<
  Record<string, StoryGlobalsMatrix>
> = {
  'space-choosing--screen': {
    spaceGame: ['light-cycles'],
    spaceRole: SPACE_ROLES,
  },
  'space-setting-up--screen': {
    spaceGame: SPACE_GAMES,
    spaceRole: SPACE_ROLES,
  },
  'space-in-game--screen': {
    spaceGame: SPACE_GAMES,
    spaceRole: SPACE_ROLES,
  },
};

/** Every combination of a story's globals, in declaration order; one empty combination without a matrix. */
export function storyGlobalsCombinations(
  matrix: StoryGlobalsMatrix | undefined
): Readonly<Record<string, string>>[] {
  return Object.entries(matrix ?? {}).reduce<Record<string, string>[]>(
    (combinations, [name, values]) =>
      combinations.flatMap((combination) =>
        values.map((value) => ({ ...combination, [name]: value }))
      ),
    [{}]
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
  const heights: Record<number, number> = {
    [phone]: Number.parseInt(viewports.phone.styles.height, 10),
    [tablet]: Number.parseInt(viewports.tablet.styles.height, 10),
    [desktop]: Number.parseInt(viewports.desktop.styles.height, 10),
  };
  // `viewport-native-height`: each width at its own viewport's height, so a
  // desktop capture shows what a 1440x900 window shows, not a phone's 844px.
  const native = story.tags?.includes('viewport-native-height') === true;
  if (story.id.startsWith('layouts-appframe')) widths.push(tablet);
  return widths
    .filter((width) => supportsStoryViewport(story, width))
    .flatMap((width) =>
      storyGlobalsCombinations(storyGlobalsMatrices[story.id]).flatMap(
        (globals) =>
          ['light', 'dark'].map((theme) => ({ width, theme, globals }))
      )
    )
    .map(({ width, theme, globals }) => {
      // Matrix values join the width suffix so each combination owns its
      // baseline and test title; stories without a matrix keep their names.
      const suffix = [
        width === 390 ? '' : `-${width}`,
        ...Object.values(globals).map((value) => `-${value}`),
      ].join('');
      return {
        width,
        theme,
        suffix,
        globals,
        // Preserve the established screenshot height while sharing native
        // widths, unless the story asks for each viewport's own height.
        height: native
          ? (heights[width] ?? heights[phone] ?? 844)
          : (heights[phone] ?? 844),
        baseline: `${slice}/baselines/chromium/${component}/${name}-${theme}${suffix}.png`,
      };
    });
}
