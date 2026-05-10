import { VariantSwatchStrip } from './avatar-editor-variant-swatch-strip';
import type { SchemaField } from './dicebear-schema';
import type { StyleKey } from './dicebear-styles';
import type { AvatarConfig } from '../shared/avatar-config';
import { Box, ResponsiveSurface, Text } from '@gamezilla/ui';
import { Trans, useLingui } from '@lingui/react/macro';

import { TriggerRow } from './avatar-editor-trigger-row';
import { getEnumSelectionMode, humanizeOptionKey } from './option-helpers';

type EnumField = Extract<SchemaField, { kind: 'enum' }>;

type UpdateOptionsFn = (
  fn: (o: Record<string, unknown>) => Record<string, unknown>
) => void;

function FeatureRow({
  field,
  draft,
  styleKey,
  seedFallback,
  updateOptions,
  surface,
  setSurface,
  closeSurface,
}: {
  field: EnumField;
  draft: AvatarConfig;
  styleKey: StyleKey;
  seedFallback: string;
  updateOptions: UpdateOptionsFn;
  surface: string | null;
  setSurface: (k: string | null) => void;
  closeSurface: () => void;
}) {
  const { t } = useLingui();
  const mode = getEnumSelectionMode(field, draft.options[field.key]);
  const summary = mode === 'random' ? t`Random` : String(mode);
  return (
    <Box>
      <TriggerRow
        label={humanizeOptionKey(field.key)}
        value={summary}
        onPress={() => setSurface(`enum:${field.key}`)}
      />
      <ResponsiveSurface
        visible={surface === `enum:${field.key}`}
        onClose={closeSurface}
        title={humanizeOptionKey(field.key)}
      >
        <VariantSwatchStrip
          field={field}
          styleKey={styleKey}
          draft={draft}
          seedFallback={seedFallback}
          onSelect={(variant) => {
            updateOptions((o) => {
              const next = { ...o };
              if (variant === null) {
                delete next[field.key];
              } else {
                next[field.key] = [variant];
              }
              return next;
            });
            closeSurface();
          }}
        />
      </ResponsiveSurface>
    </Box>
  );
}

export function FeaturesBlock({
  featureEnums,
  draft,
  styleKey,
  seedFallback,
  updateOptions,
  surface,
  setSurface,
  closeSurface,
}: {
  featureEnums: EnumField[];
  draft: AvatarConfig;
  styleKey: StyleKey;
  seedFallback: string;
  updateOptions: UpdateOptionsFn;
  surface: string | null;
  setSurface: (k: string | null) => void;
  closeSurface: () => void;
}) {
  if (featureEnums.length === 0) return null;
  return (
    <Box sx={{ mt: 2 }}>
      <Text variant="label" label={<Trans>Features</Trans>} />
      {featureEnums.map((f) => (
        <FeatureRow
          key={f.key}
          field={f}
          draft={draft}
          styleKey={styleKey}
          seedFallback={seedFallback}
          updateOptions={updateOptions}
          surface={surface}
          setSurface={setSurface}
          closeSurface={closeSurface}
        />
      ))}
    </Box>
  );
}
