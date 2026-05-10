import type { SchemaField } from './dicebear-schema';
import type { AvatarConfig } from '../shared/avatar-config';
import { Box, NumberStepper, Switch, Text } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';

import { humanizeOptionKey } from './option-helpers';

type UpdateOptionsFn = (
  fn: (o: Record<string, unknown>) => Record<string, unknown>
) => void;

function BooleanRow({
  field,
  draft,
  updateOptions,
}: {
  field: Extract<SchemaField, { kind: 'boolean' }>;
  draft: AvatarConfig;
  updateOptions: UpdateOptionsFn;
}) {
  const val =
    typeof draft.options[field.key] === 'boolean'
      ? (draft.options[field.key] as boolean)
      : field.default;
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        py: 2,
      }}
    >
      <Text variant="label" label={humanizeOptionKey(field.key)} />
      <Switch
        value={val}
        onValueChange={(v) => {
          updateOptions((o) => ({ ...o, [field.key]: v }));
        }}
      />
    </Box>
  );
}

function IntegerRow({
  field,
  draft,
  updateOptions,
}: {
  field: Extract<SchemaField, { kind: 'integer' }>;
  draft: AvatarConfig;
  updateOptions: UpdateOptionsFn;
}) {
  const val =
    typeof draft.options[field.key] === 'number'
      ? (draft.options[field.key] as number)
      : field.default;
  return (
    <NumberStepper
      label={humanizeOptionKey(field.key)}
      min={field.min}
      max={field.max}
      value={val}
      onChange={(n) => {
        updateOptions((o) => ({ ...o, [field.key]: n }));
      }}
    />
  );
}

export function TransformBlock({
  fields,
  draft,
  updateOptions,
}: {
  fields: SchemaField[];
  draft: AvatarConfig;
  updateOptions: UpdateOptionsFn;
}) {
  if (fields.length === 0) return null;
  return (
    <Box sx={{ mt: 2, gap: 1 }}>
      <Text variant="label" label={<Trans>Transform</Trans>} />
      {fields.map((f) => {
        if (f.kind === 'boolean') {
          return (
            <BooleanRow
              key={f.key}
              field={f}
              draft={draft}
              updateOptions={updateOptions}
            />
          );
        }
        if (f.kind === 'integer') {
          return (
            <IntegerRow
              key={f.key}
              field={f}
              draft={draft}
              updateOptions={updateOptions}
            />
          );
        }
        return null;
      })}
    </Box>
  );
}
