/**
 * `ThemeTokens` -- visual inventory of every design-system token: color
 * swatches (per scheme), radius, spacing, elevation, and motion previews.
 *
 * Used in the explorer to make token drift instantly visible.
 */

import { type ColorTokens, useTheme } from '../../theme';
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

const COLOR_GROUPS: readonly {
  title: string;
  tokens: readonly (keyof ColorTokens)[];
}[] = [
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
  {
    title: 'Foreground',
    tokens: ['text', 'textSecondary', 'icon'],
  },
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
  {
    title: 'Borders / focus',
    tokens: ['border', 'outline', 'focusRing'],
  },
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
  {
    title: 'States / shadow',
    tokens: ['disabled', 'shadowColor'],
  },
  {
    title: 'Tabs',
    tokens: ['tabIconDefault', 'tabIconSelected'],
  },
];

const ELEVATION_LEVELS: readonly ElevationLevel[] = [0, 1, 2, 3, 4, 5];

export default function ThemeTokensExample() {
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

function SectionTitle({ title }: { title: string }) {
  return (
    <Text variant="title" sx={{ mt: 4, mb: 2, color: 'text' }} label={title} />
  );
}

function ColorGroups() {
  return (
    <Box sx={{ gap: 4 }}>
      {COLOR_GROUPS.map((group) => (
        <Box key={group.title} sx={{ gap: 1.5 }}>
          <Text
            variant="label"
            sx={{ color: 'textSecondary' }}
            label={group.title}
          />
          <Box sx={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
            {group.tokens.map((tok) => (
              <ColorSwatch key={tok} token={tok} />
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function ColorSwatch({ token }: { token: keyof ColorTokens }) {
  const theme = useTheme();
  const value = theme.colors[token];
  return (
    <Box
      sx={{
        width: 132,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: 'border',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          height: 56,
          backgroundColor: value,
        }}
      />
      <Box sx={{ px: 2, py: 1, background: 'surface' }}>
        <Text
          variant="caption"
          numberOfLines={1}
          ellipsizeMode="tail"
          sx={{ color: 'text' }}
          label={token}
        />
        <Text
          variant="caption"
          numberOfLines={1}
          ellipsizeMode="tail"
          sx={{ color: 'textSecondary' }}
          label={value}
        />
      </Box>
    </Box>
  );
}

function RadiusRow() {
  const keys = Object.keys(borderRadius) as BorderRadiusKey[];
  return (
    <Box sx={{ flexDirection: 'row', gap: 3, flexWrap: 'wrap' }}>
      {keys.map((k) => (
        <RadiusSample key={k} radiusKey={k} />
      ))}
    </Box>
  );
}

function RadiusSample({ radiusKey }: { radiusKey: BorderRadiusKey }) {
  const value = borderRadius[radiusKey];
  const display = value === 9999 ? 'full' : `${value}px`;
  return (
    <Box sx={{ alignItems: 'center', gap: 1 }}>
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: value,
          backgroundColor: 'tintSubtle',
          borderWidth: 1,
          borderColor: 'tint',
        }}
      />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={radiusKey}
      />
      <Text variant="caption" sx={{ color: 'textSecondary' }} label={display} />
    </Box>
  );
}

function SpacingRow() {
  const entries = Object.entries(spacing).map(([k, v]) => ({
    key: k,
    value: v as number,
  }));
  return (
    <Box sx={{ gap: 1.5 }}>
      {entries.map(({ key, value }) => (
        <Box
          key={key}
          sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
        >
          <Text
            variant="caption"
            sx={{ color: 'textSecondary', width: 32 }}
            label={key}
          />
          <SpacingBar width={value} />
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            label={`${value}px`}
          />
        </Box>
      ))}
    </Box>
  );
}

function SpacingBar({ width }: { width: number }) {
  return (
    <Box
      sx={{
        height: 10,
        width: Math.max(width, 1),
        backgroundColor: 'tint',
        borderRadius: borderRadius.xs,
      }}
    />
  );
}

function ElevationRow() {
  return (
    <Box sx={{ flexDirection: 'row', gap: 3, flexWrap: 'wrap' }}>
      {ELEVATION_LEVELS.map((level) => (
        <ElevationSample key={level} level={level} />
      ))}
    </Box>
  );
}

function ElevationSample({ level }: { level: ElevationLevel }) {
  const theme = useTheme();
  const lift = theme.elevation(level);
  const bg = lift.backgroundColor ?? theme.colors.surfaceElevated;
  return (
    <Box sx={{ alignItems: 'center', gap: 1 }}>
      <Box
        sx={{
          width: 88,
          height: 64,
          backgroundColor: bg,
          borderRadius: borderRadius.md,
          elevation: level,
          ...(lift.boxShadow ? { boxShadow: lift.boxShadow } : {}),
        }}
      />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={`level ${level}`}
      />
    </Box>
  );
}

function MotionRow() {
  const durations = Object.entries(duration);
  const easings = Object.entries(easing);
  return (
    <Box sx={{ gap: 2 }}>
      <Text variant="label" sx={{ color: 'textSecondary' }} label="Durations" />
      {durations.map(([k, v]) => (
        <Box
          key={k}
          sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}
        >
          <Text variant="caption" sx={{ color: 'text', width: 80 }} label={k} />
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            label={`${v}ms`}
          />
        </Box>
      ))}
      <Text
        variant="label"
        sx={{ color: 'textSecondary', mt: 2 }}
        label="Easings"
      />
      {easings.map(([k, v]) => (
        <Box key={k} sx={{ flexDirection: 'row', gap: 2 }}>
          <Text variant="caption" sx={{ color: 'text', width: 80 }} label={k} />
          <Text
            variant="caption"
            numberOfLines={1}
            ellipsizeMode="tail"
            sx={{ color: 'textSecondary' }}
            label={v}
          />
        </Box>
      ))}
    </Box>
  );
}
