/**
 * `ThemeTokens` -- visual inventory of every design-system token: color
 * swatches (per scheme), radius, spacing, elevation, and motion previews.
 *
 * Used in the explorer to make token drift instantly visible.
 */

import { View } from 'react-native';

import { useTheme, type ColorTokens } from '../../theme';
import { duration, easing } from '../../theme/motion';
import {
  borderRadius,
  spacing,
  type BorderRadiusKey,
  type ElevationLevel,
} from '../../theme/scale';
import { Box } from '../box';
import { SchemePreview } from '../explorer/scheme-preview';
import { ScrollView } from '../scroll-view';
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
      'onTint',
    ],
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
    <ScrollView sx={{ p: 4, gap: 5 }}>
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
    </ScrollView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text
      variant="title"
      sx={{ mt: 4, mb: 2, color: 'text' }}
      label={title}
    />
  );
}

function ColorGroups() {
  return (
    <View style={{ gap: 16 }}>
      {COLOR_GROUPS.map((group) => (
        <View key={group.title} style={{ gap: 6 }}>
          <Text
            variant="label"
            sx={{ color: 'textSecondary' }}
            label={group.title}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {group.tokens.map((tok) => (
              <ColorSwatch key={tok} token={tok} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function ColorSwatch({ token }: { token: keyof ColorTokens }) {
  const theme = useTheme();
  const value = theme.colors[token];
  return (
    <View
      style={{
        width: 132,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: theme.colors.border,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
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
    </View>
  );
}

function RadiusRow() {
  const keys = Object.keys(borderRadius) as BorderRadiusKey[];
  return (
    <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
      {keys.map((k) => (
        <RadiusSample key={k} radiusKey={k} />
      ))}
    </View>
  );
}

function RadiusSample({ radiusKey }: { radiusKey: BorderRadiusKey }) {
  const theme = useTheme();
  const value = borderRadius[radiusKey];
  const display = value === 9999 ? 'full' : `${value}px`;
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: value,
          backgroundColor: theme.colors.tintSubtle,
          borderWidth: 1,
          borderColor: theme.colors.tint,
        }}
      />
      <Text variant="caption" sx={{ color: 'textSecondary' }} label={radiusKey} />
      <Text variant="caption" sx={{ color: 'textSecondary' }} label={display} />
    </View>
  );
}

function SpacingRow() {
  const entries = Object.entries(spacing).map(([k, v]) => ({
    key: k,
    value: v as number,
  }));
  return (
    <View style={{ gap: 6 }}>
      {entries.map(({ key, value }) => (
        <View
          key={key}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
        >
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            style={{ width: 32 }}
            label={key}
          />
          <SpacingBar width={value} />
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            label={`${value}px`}
          />
        </View>
      ))}
    </View>
  );
}

function SpacingBar({ width }: { width: number }) {
  const theme = useTheme();
  return (
    <View
      style={{
        height: 10,
        width: Math.max(width, 1),
        backgroundColor: theme.colors.tint,
        borderRadius: borderRadius.xs,
      }}
    />
  );
}

function ElevationRow() {
  return (
    <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>
      {ELEVATION_LEVELS.map((level) => (
        <ElevationSample key={level} level={level} />
      ))}
    </View>
  );
}

function ElevationSample({ level }: { level: ElevationLevel }) {
  const theme = useTheme();
  const lift = theme.elevation(level);
  const bg = lift.backgroundColor ?? theme.colors.surfaceElevated;
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <View
        style={{
          width: 88,
          height: 64,
          backgroundColor: bg,
          borderRadius: borderRadius.md,
          ...(lift.boxShadow ? { boxShadow: lift.boxShadow } : {}),
          ...(lift.elevation !== undefined ? { elevation: lift.elevation } : {}),
        }}
      />
      <Text variant="caption" sx={{ color: 'textSecondary' }} label={`level ${level}`} />
    </View>
  );
}

function MotionRow() {
  const durations = Object.entries(duration);
  const easings = Object.entries(easing);
  return (
    <View style={{ gap: 8 }}>
      <Text variant="label" sx={{ color: 'textSecondary' }} label="Durations" />
      {durations.map(([k, v]) => (
        <View
          key={k}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
        >
          <Text
            variant="caption"
            sx={{ color: 'text' }}
            style={{ width: 80 }}
            label={k}
          />
          <Text
            variant="caption"
            sx={{ color: 'textSecondary' }}
            label={`${v}ms`}
          />
        </View>
      ))}
      <Text
        variant="label"
        sx={{ color: 'textSecondary', mt: 2 }}
        label="Easings"
      />
      {easings.map(([k, v]) => (
        <View key={k} style={{ flexDirection: 'row', gap: 8 }}>
          <Text
            variant="caption"
            sx={{ color: 'text' }}
            style={{ width: 80 }}
            label={k}
          />
          <Text
            variant="caption"
            numberOfLines={1}
            ellipsizeMode="tail"
            sx={{ color: 'textSecondary' }}
            label={v}
          />
        </View>
      ))}
    </View>
  );
}
