/** @jsxImportSource solid-js */
import { cssPx } from '@pkgs/ui-root-shared-ts/css-px';

/**
 * `ThemeTokens` -- visual inventory of every design-system token: color
 * swatches (per scheme), radius, spacing, elevation, and motion previews.
 *
 * Used in the explorer to make token drift instantly visible.
 */

import { useThemeTokens } from '@pkgs/ui-root-client-ts/theme-context';
import type { ColorTokens } from '@pkgs/ui-root-shared-ts/colors-types';
import { duration, easing } from '@pkgs/ui-root-shared-ts/motion';
import type {
  BorderRadiusKey,
  ElevationLevel,
} from '@pkgs/ui-root-shared-ts/scale';
import { borderRadius, spacing } from '@pkgs/ui-root-shared-ts/scale';
import { For, type JSX } from 'solid-js';
import { ExampleRoot } from '../../storybook/fixtures/example-root';
import { SchemePreview } from '../../storybook/fixtures/scheme-preview';

type ColorGroup = {
  title: string;
  tokens: readonly (keyof ColorTokens)[];
};

const COLOR_GROUPS: readonly ColorGroup[] = [
  {
    title: 'Surfaces',
    tokens: [
      'background',
      'surface',
      'surfaceMuted',
      'surfaceElevated',
      'surfaceOverlay',
    ],
  },
  { title: 'Foreground', tokens: ['text', 'textSecondary', 'icon'] },
  {
    title: 'Brand / interactive',
    tokens: ['tint', 'tintHover', 'tintActive', 'tintSubtle'],
  },
  {
    title: 'On-color foregrounds',
    tokens: ['onPrimary', 'onDestructive', 'onSuccess', 'onWarning', 'onInfo'],
  },
  {
    title: 'Overlays',
    tokens: ['interactiveHover', 'interactivePress', 'scrim'],
  },
  { title: 'Borders / focus', tokens: ['border', 'outline', 'focusRing'] },
  {
    title: 'Semantic',
    tokens: [
      'destructive',
      'destructiveSurface',
      'success',
      'successSurface',
      'warning',
      'warningSurface',
      'info',
      'infoSurface',
    ],
  },
  { title: 'States / shadow', tokens: ['disabled', 'shadowColor'] },
];

const ELEVATION_LEVELS: readonly ElevationLevel[] = [0, 1, 2, 3, 4, 5];
const RADIUS_KEYS = Object.keys(borderRadius) as BorderRadiusKey[];
const SPACING_ENTRIES = Object.entries(spacing).map(([key, value]) => ({
  key,
  value,
}));
const DURATIONS = Object.entries(duration);
const EASINGS = Object.entries(easing);

export default function ThemeTokensExample(): JSX.Element {
  return (
    <ExampleRoot gap="xl">
      <SectionTitle title="Colors" />
      <SchemePreview>
        <ColorGroups />
      </SchemePreview>

      <SectionTitle title="Radius" />
      <SchemePreview>
        <RadiusRow />
      </SchemePreview>

      <SectionTitle title="Spacing" />
      <SchemePreview>
        <SpacingRow />
      </SchemePreview>

      <SectionTitle title="Elevation" />
      <SchemePreview>
        <ElevationRow />
      </SchemePreview>

      <SectionTitle title="Motion" />
      <SchemePreview>
        <MotionRow />
      </SchemePreview>
    </ExampleRoot>
  );
}

function SectionTitle(props: { title: string }): JSX.Element {
  return <h1 class="text textTitle mt-4 mb-2 text-text">{props.title}</h1>;
}

function ColorGroups(): JSX.Element {
  return (
    <div class="box gap-4">
      <For each={COLOR_GROUPS}>
        {(group) => (
          <div class="box gap-2">
            <label class="text textLabel text-text-secondary">
              {group.title}
            </label>
            <div class="box flex-row flex-wrap gap-2">
              <For each={group.tokens}>
                {(token) => <ColorSwatch token={token} />}
              </For>
            </div>
          </div>
        )}
      </For>
    </div>
  );
}

function ColorSwatch(props: { token: keyof ColorTokens }): JSX.Element {
  const theme = useThemeTokens();
  const value = () => theme.colors[props.token];
  return (
    <div class="box w-33 rounded-control border border-solid border-border overflow-hidden">
      <div class="box h-14" style={{ 'background-color': value() }} />
      <div class="box px-2 py-1 bg-surface">
        <p class="text textCaption line-clamp-1 text-text">{props.token}</p>
        <p class="text textCaption line-clamp-1 text-text-secondary">
          {value()}
        </p>
      </div>
    </div>
  );
}

function RadiusRow(): JSX.Element {
  return (
    <div class="box flex-row gap-3 flex-wrap">
      <For each={RADIUS_KEYS}>{(k) => <RadiusSample radiusKey={k} />}</For>
    </div>
  );
}

function RadiusSample(props: { radiusKey: BorderRadiusKey }): JSX.Element {
  const value = () => borderRadius[props.radiusKey];
  const display = () => (value() === 9999 ? 'full' : `${value()}px`);
  return (
    <div class="box items-center gap-1">
      <div
        class="box w-16 h-16 bg-tint-subtle border border-solid border-tint"
        style={{
          'border-radius': value() === 9999 ? '9999px' : cssPx(value()),
        }}
      />
      <p class="text textCaption text-text-secondary">{props.radiusKey}</p>
      <p class="text textCaption text-text-secondary">{display()}</p>
    </div>
  );
}

function SpacingRow(): JSX.Element {
  return (
    <div class="box gap-2">
      <For each={SPACING_ENTRIES}>
        {(entry) => (
          <div class="box flex-row items-center gap-2">
            <p class="text textCaption text-text-secondary w-8">{entry.key}</p>
            <div
              class="box h-3 bg-tint rounded-sm"
              style={{ width: cssPx(Math.max(entry.value, 1)) }}
            />
            <p class="text textCaption text-text-secondary">{`${entry.value}px`}</p>
          </div>
        )}
      </For>
    </div>
  );
}

function ElevationRow(): JSX.Element {
  return (
    <div class="box flex-row gap-3 flex-wrap">
      <For each={ELEVATION_LEVELS}>
        {(level) => (
          <div class="box items-center gap-1">
            <div
              class={`box w-22 h-16 rounded-control bg-elevation-${level}`}
            />
            <p class="text textCaption text-text-secondary">{`level ${level}`}</p>
          </div>
        )}
      </For>
    </div>
  );
}

function MotionRow(): JSX.Element {
  return (
    <div class="box gap-2">
      <label class="text textLabel text-text-secondary">{'Durations'}</label>
      <For each={DURATIONS}>
        {([k, v]) => (
          <div class="box flex-row items-center gap-2">
            <p class="text textCaption text-text w-20">{k}</p>
            <p class="text textCaption text-text-secondary">{`${v}ms`}</p>
          </div>
        )}
      </For>
      <label class="text textLabel text-text-secondary mt-2">{'Easings'}</label>
      <For each={EASINGS}>
        {([k, v]) => (
          <div class="box flex-row gap-2">
            <p class="text textCaption text-text w-20">{k}</p>
            <p class="text textCaption line-clamp-1 text-text-secondary">{v}</p>
          </div>
        )}
      </For>
    </div>
  );
}
