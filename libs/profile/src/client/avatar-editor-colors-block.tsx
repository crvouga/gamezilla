import type { SchemaField } from './dicebear-schema';
import type { AvatarConfig } from '../shared/avatar-config';
import {
  Box,
  MultiSelectSwatchGrid,
  ResponsiveSurface,
  Text,
} from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@lingui/react/macro';

import { TriggerRow } from './avatar-editor-trigger-row';
import { humanizeOptionKey } from './option-helpers';

type ColorField = Extract<SchemaField, { kind: 'color' }>;

type UpdateOptionsFn = (
  fn: (o: Record<string, unknown>) => Record<string, unknown>
) => void;

function ColorRow({
  field,
  draft,
  updateOptions,
  surface,
  setSurface,
  closeSurface,
}: {
  field: ColorField;
  draft: AvatarConfig;
  updateOptions: UpdateOptionsFn;
  surface: string | null;
  setSurface: (k: string | null) => void;
  closeSurface: () => void;
}) {
  const { t } = useLingui();
  const current = Array.isArray(draft.options[field.key])
    ? (draft.options[field.key] as string[])
    : field.default;
  const count = current.length;
  const summary = count === 0 ? '—' : t`${count} selected`;
  return (
    <Box>
      <TriggerRow
        label={humanizeOptionKey(field.key)}
        value={summary}
        onPress={() => setSurface(`color:${field.key}`)}
      />
      <ResponsiveSurface
        visible={surface === `color:${field.key}`}
        onClose={closeSurface}
        title={humanizeOptionKey(field.key)}
      >
        <MultiSelectSwatchGrid
          label={null}
          palette={[...new Set([...field.default, ...current])]}
          defaultPalette={field.default}
          value={current}
          allowTransparent
          onChange={(next) => {
            updateOptions((o) => ({
              ...o,
              [field.key]: next,
            }));
          }}
        />
      </ResponsiveSurface>
    </Box>
  );
}

export function ColorsBlock({
  colorFields,
  draft,
  updateOptions,
  surface,
  setSurface,
  closeSurface,
}: {
  colorFields: SchemaField[];
  draft: AvatarConfig;
  updateOptions: UpdateOptionsFn;
  surface: string | null;
  setSurface: (k: string | null) => void;
  closeSurface: () => void;
}) {
  const fields = colorFields.filter((f): f is ColorField => f.kind === 'color');
  if (fields.length === 0) return null;
  return (
    <Box sx={{ mt: 2 }}>
      <Text variant="label" label={<Trans>Colors</Trans>} />
      {fields.map((f) => (
        <ColorRow
          key={f.key}
          field={f}
          draft={draft}
          updateOptions={updateOptions}
          surface={surface}
          setSurface={setSurface}
          closeSurface={closeSurface}
        />
      ))}
    </Box>
  );
}
