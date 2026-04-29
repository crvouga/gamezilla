import type { SchemaField } from '@gamezilla/client/profile/dicebear-schema';
import type { AvatarConfig } from '@gamezilla/domain/profile/avatar-config';
import {
  Box,
  MultiSelectSwatchGrid,
  NumberStepper,
  ResponsiveSurface,
  SegmentedControl,
  Text,
} from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@gamezilla/lib/i18n';

import { TriggerRow } from './avatar-editor-trigger-row';

type UpdateOptionsFn = (
  fn: (o: Record<string, unknown>) => Record<string, unknown>
) => void;

const SOLID = 'solid' as const;
const GRADIENT = 'gradient' as const;
const BOTH = 'both' as const;
const GRADIENT_LINEAR = 'gradientLinear' as const;

type BackgroundMode = typeof SOLID | typeof GRADIENT | typeof BOTH;

function backgroundTypeMode(v: unknown): BackgroundMode {
  const a = Array.isArray(v) ? (v as string[]) : [SOLID];
  const hasS = a.includes(SOLID);
  const hasG = a.includes(GRADIENT_LINEAR);
  if (hasS && hasG) return BOTH;
  if (hasG) return GRADIENT;
  return SOLID;
}

function modeToBackgroundType(m: BackgroundMode): string[] {
  if (m === SOLID) return [SOLID];
  if (m === GRADIENT) return [GRADIENT_LINEAR];
  return [SOLID, GRADIENT_LINEAR];
}

type EnumField = Extract<SchemaField, { kind: 'enum' }>;
type ColorField = Extract<SchemaField, { kind: 'color' }>;
type IntArrayField = Extract<SchemaField, { kind: 'integerArray' }>;

function pickFields(fields: SchemaField[]) {
  const bt = fields.find((f) => f.key === 'backgroundType');
  const bc = fields.find((f) => f.key === 'backgroundColor');
  const br = fields.find(
    (f) => f.kind === 'integerArray' && f.key === 'backgroundRotation'
  );
  return {
    typeField: bt?.kind === 'enum' ? (bt as EnumField) : null,
    colorField: bc?.kind === 'color' ? (bc as ColorField) : null,
    rotField: br?.kind === 'integerArray' ? (br as IntArrayField) : null,
  };
}

function TypeSegment({
  mode,
  updateOptions,
}: {
  mode: BackgroundMode;
  updateOptions: UpdateOptionsFn;
}) {
  const { t } = useLingui();
  return (
    <Box sx={{ gap: 2 }}>
      <Text variant="caption" sx={{ opacity: 0.8 }} label={<Trans>Type</Trans>} />
      <SegmentedControl
        segments={[
          { key: SOLID, label: t`Solid` },
          { key: GRADIENT, label: t`Gradient` },
          { key: BOTH, label: t`Both` },
        ]}
        selected={mode}
        onSelect={(k) => {
          updateOptions((opts) => ({
            ...opts,
            backgroundType: modeToBackgroundType(k as BackgroundMode),
          }));
        }}
      />
    </Box>
  );
}

function ColorPickerRow({
  colorField,
  options,
  updateOptions,
  surface,
  setSurface,
  closeSurface,
}: {
  colorField: ColorField;
  options: Record<string, unknown>;
  updateOptions: UpdateOptionsFn;
  surface: string | null;
  setSurface: (k: string | null) => void;
  closeSurface: () => void;
}) {
  const { t } = useLingui();
  const bgColors = Array.isArray(options['backgroundColor'])
    ? (options['backgroundColor'] as string[])
    : colorField.default;
  const count = bgColors.length;
  return (
    <>
      <TriggerRow
        label={t`Background colors`}
        value={count === 0 ? '—' : t`${count} selected`}
        onPress={() => setSurface('bg-color')}
      />
      <ResponsiveSurface
        visible={surface === 'bg-color'}
        onClose={closeSurface}
        title={t`Background colors`}
      >
        <MultiSelectSwatchGrid
          label={null}
          palette={[...new Set([...colorField.default, ...bgColors])]}
          defaultPalette={colorField.default}
          value={bgColors}
          allowTransparent
          onChange={(next) => {
            updateOptions((opts) => ({
              ...opts,
              backgroundColor: next,
            }));
          }}
        />
      </ResponsiveSurface>
    </>
  );
}

function readRotationAt(
  options: Record<string, unknown>,
  index: 0 | 1,
  fallback: number
): number {
  if (!Array.isArray(options['backgroundRotation'])) return fallback;
  const n = (options['backgroundRotation'] as number[])[index];
  return typeof n === 'number' ? n : fallback;
}

function RotationControls({
  rotField,
  options,
  updateOptions,
  mode,
}: {
  rotField: IntArrayField;
  options: Record<string, unknown>;
  updateOptions: UpdateOptionsFn;
  mode: BackgroundMode;
}) {
  const { t } = useLingui();
  const rotMinDefault = rotField.default[0] ?? 0;
  const rotMaxDefault = rotField.default[1] ?? 360;
  return (
    <Box sx={{ gap: 2, opacity: mode === SOLID ? 0.45 : 1 }}>
      <Text
        variant="caption"
        sx={{ opacity: 0.8 }}
        label={<Trans>Gradient rotation (°)</Trans>}
      />
      <NumberStepper
        label={t`Min rotation`}
        min={rotField.itemMin}
        max={rotField.itemMax}
        disabled={mode === SOLID}
        value={readRotationAt(options, 0, rotMinDefault)}
        onChange={(n) => {
          updateOptions((opts) => {
            const cur = Array.isArray(opts['backgroundRotation'])
              ? [...(opts['backgroundRotation'] as number[])]
              : [...rotField.default];
            cur[0] = n;
            if (cur.length < 2) cur.push(rotField.default[1] ?? 360);
            return { ...opts, backgroundRotation: cur };
          });
        }}
      />
      <NumberStepper
        label={t`Max rotation`}
        min={rotField.itemMin}
        max={rotField.itemMax}
        disabled={mode === SOLID}
        value={readRotationAt(options, 1, rotMaxDefault)}
        onChange={(n) => {
          updateOptions((opts) => {
            const cur = Array.isArray(opts['backgroundRotation'])
              ? [...(opts['backgroundRotation'] as number[])]
              : [...rotField.default];
            if (cur.length < 2) cur.unshift(rotField.default[0] ?? 0);
            cur[1] = n;
            return { ...opts, backgroundRotation: cur };
          });
        }}
      />
    </Box>
  );
}

export function BackgroundBlock({
  fields,
  draft,
  updateOptions,
  surface,
  setSurface,
  closeSurface,
}: {
  fields: SchemaField[];
  draft: AvatarConfig;
  updateOptions: UpdateOptionsFn;
  surface: string | null;
  setSurface: (k: string | null) => void;
  closeSurface: () => void;
}) {
  const { typeField, colorField, rotField } = pickFields(fields);
  const o = draft.options;
  const mode = backgroundTypeMode(o['backgroundType']);

  return (
    <Box sx={{ mt: 2, gap: 3 }}>
      <Text variant="label" label={<Trans>Background</Trans>} />
      {typeField ? (
        <TypeSegment mode={mode} updateOptions={updateOptions} />
      ) : null}
      {colorField ? (
        <ColorPickerRow
          colorField={colorField}
          options={o}
          updateOptions={updateOptions}
          surface={surface}
          setSurface={setSurface}
          closeSurface={closeSurface}
        />
      ) : null}
      {rotField ? (
        <RotationControls
          rotField={rotField}
          options={o}
          updateOptions={updateOptions}
          mode={mode}
        />
      ) : null}
    </Box>
  );
}
