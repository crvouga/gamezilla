import type { SchemaField } from './dicebear-schema';
import type { AvatarConfig } from '../shared/avatar-config';
import { Box, ChipGroup, Text } from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';

import { getProbabilityMode, humanizeOptionKey } from './option-helpers';

type ProbabilityField = Extract<SchemaField, { kind: 'probability' }>;

type UpdateOptionsFn = (
  fn: (o: Record<string, unknown>) => Record<string, unknown>
) => void;

export function EffectsBlock({
  effectFields,
  draft,
  updateOptions,
}: {
  effectFields: SchemaField[];
  draft: AvatarConfig;
  updateOptions: UpdateOptionsFn;
}) {
  const { t } = useLingui();
  const fields = effectFields.filter(
    (f): f is ProbabilityField => f.kind === 'probability'
  );
  if (fields.length === 0) return null;
  return (
    <Box sx={{ mt: 2, gap: 2 }}>
      <Text variant="label" label={<Trans>Effects</Trans>} />
      {fields.map((f) => (
        <ChipGroup
          key={f.key}
          label={humanizeOptionKey(f.key)}
          options={[
            { key: 'off', label: t`Off` },
            { key: 'random', label: t`Random` },
            { key: 'always', label: t`Always` },
          ]}
          selected={getProbabilityMode(draft.options[f.key])}
          onSelect={(mode) => {
            updateOptions((o) => {
              const next = { ...o };
              if (mode === 'random') {
                delete next[f.key];
              } else if (mode === 'off') {
                next[f.key] = 0;
              } else {
                next[f.key] = 100;
              }
              return next;
            });
          }}
        />
      ))}
    </Box>
  );
}
