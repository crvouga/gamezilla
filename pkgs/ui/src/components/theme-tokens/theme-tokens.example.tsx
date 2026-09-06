/** @jsxImportSource solid-js */
/**
 * `ThemeTokens` -- visual inventory of every design-system token: color
 * swatches (per scheme), radius, spacing, elevation, and motion previews.
 *
 * Used in the explorer to make token drift instantly visible.
 */

import { For, type JSX } from 'solid-js';
import { type ColorTokens, useThemeTokens } from '../../theme';
import { duration, easing } from '../../theme/motion';
import {
  type BorderRadiusKey,
  borderRadius,
  type ElevationLevel,
  spacing,
} from '../../theme/scale';
import { Box } from '../box';
import { ExampleRoot } from '../explorer/example-root';
import { SchemePreview } from '../explorer/scheme-preview';
import { Text } from '../text';

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
      'surfaceSunken',
      'surfaceMuted',
      'surfaceElevated',
      'surfaceOverlay',
    ],
  },
  { title: 'Foreground', tokens: ['text', 'textSecondary', 'icon'] },
  {
    title: 'Brand / interactive',
    tokens: [
      'tint',
      'tintHover',
      'tintActive',
      'tintSubtle',
      'tintMuted',
      'tintHighlight',
    ],
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
  { title: 'Tabs', tokens: ['tabIconDefault', 'tabIconSelected'] },
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
    <ExampleRoot sx={{ gap: 5 }}>
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
  return (
    <Text
      variant="title"
      sx={{ mt: 4, mb: 2, color: 'text' }}
      label={props.title}
    />
  );
}

function ColorGroups(): JSX.Element {
  return (
    <Box sx={{ gap: 4 }}>
      <For each={COLOR_GROUPS}>
        {(group) => (
          <Box sx={{ gap: 1.5 }}>
            <Text
              variant="label"
              sx={{ color: 'textSecondary' }}
              label={group.title}
            />
            <Box sx={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
              <For each={group.tokens}>
                {(token) => <ColorSwatch token={token} />}
              </For>
            </Box>
          </Box>
        )}
      </For>
    </Box>
  );
}

function ColorSwatch(props: { token: keyof ColorTokens }): JSX.Element {
  const theme = useThemeTokens();
  const value = () => theme.colors[props.token];
  return (
    <Box
      sx={{
        width: 132,
        borderRadius: 'md',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: 'border',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ height: 56, backgroundColor: value() }} />
      <Box sx={{ px: 2, py: 1, background: 'surface' }}>
        <Text
          variant="caption"
          numberOfLines={1}
          sx={{ color: 'text' }}
          label={props.token}
        />
        <Text
          variant="caption"
          numberOfLines={1}
          sx={{ color: 'textSecondary' }}
          label={value()}
        />
      </Box>
    </Box>
  );
}

function RadiusRow(): JSX.Element {
  return (
    <Box sx={{ flexDirection: 'row', gap: 3, flexWrap: 'wrap' }}>
      <For each={RADIUS_KEYS}>{(k) => <RadiusSample radiusKey={k} />}</For>
    </Box>
  );
}

function RadiusSample(props: { radiusKey: BorderRadiusKey }): JSX.Element {
  const value = () => borderRadius[props.radiusKey];
  const display = () => (value() === 9999 ? 'full' : `${value()}px`);
  return (
    <Box sx={{ alignItems: 'center', gap: 1 }}>
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: value(),
          backgroundColor: 'tintSubtle',
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: 'tint',
        }}
      />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={props.radiusKey}
      />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={display()}
      />
    </Box>
  );
}

function SpacingRow(): JSX.Element {
  return (
    <Box sx={{ gap: 1.5 }}>
      <For each={SPACING_ENTRIES}>
        {(entry) => (
          <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text
              variant="caption"
              sx={{ color: 'textSecondary', width: 32 }}
              label={entry.key}
            />
            <Box
              sx={{
                height: 10,
                width: Math.max(entry.value, 1),
                backgroundColor: 'tint',
                borderRadius: 'xs',
              }}
            />
            <Text
              variant="caption"
              sx={{ color: 'textSecondary' }}
              label={`${entry.value}px`}
            />
          </Box>
        )}
      </For>
    </Box>
  );
}

function ElevationRow(): JSX.Element {
  return (
    <Box sx={{ flexDirection: 'row', gap: 3, flexWrap: 'wrap' }}>
      <For each={ELEVATION_LEVELS}>
        {(level) => (
          <Box sx={{ alignItems: 'center', gap: 1 }}>
            <Box
              sx={{
                width: 88,
                height: 64,
                backgroundColor: 'surfaceElevated',
                borderRadius: 'md',
                elevation: level,
              }}
            />
            <Text
              variant="caption"
              sx={{ color: 'textSecondary' }}
              label={`level ${level}`}
            />
          </Box>
        )}
      </For>
    </Box>
  );
}

function MotionRow(): JSX.Element {
  return (
    <Box sx={{ gap: 2 }}>
      <Text variant="label" sx={{ color: 'textSecondary' }} label="Durations" />
      <For each={DURATIONS}>
        {([k, v]) => (
          <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
            <Text
              variant="caption"
              sx={{ color: 'text', width: 80 }}
              label={k}
            />
            <Text
              variant="caption"
              sx={{ color: 'textSecondary' }}
              label={`${v}ms`}
            />
          </Box>
        )}
      </For>
      <Text
        variant="label"
        sx={{ color: 'textSecondary', mt: 2 }}
        label="Easings"
      />
      <For each={EASINGS}>
        {([k, v]) => (
          <Box sx={{ flexDirection: 'row', gap: 2 }}>
            <Text
              variant="caption"
              sx={{ color: 'text', width: 80 }}
              label={k}
            />
            <Text
              variant="caption"
              numberOfLines={1}
              sx={{ color: 'textSecondary' }}
              label={v}
            />
          </Box>
        )}
      </For>
    </Box>
  );
}
