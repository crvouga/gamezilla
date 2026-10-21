import {
  DEFAULT_SYNTHETIC_POPULATION_CONFIG,
  type SyntheticPopulationConfig,
  syntheticPopulationConfigSchema,
} from '@libs/synthetic-population-shared-ts/config';
import { Trans, useLingui } from '@lingui/solid/macro';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { TextInput } from '@pkgs/ui-root-client-ts/text-input';
import { createSignal, For, type JSX } from 'solid-js';

const numericFields = [
  'desired',
  'capacityPerWorker',
  'leaseMs',
  'actionIntervalMs',
  'sessionMs',
] as const;
type Field = (typeof numericFields)[number] | 'preferredVersion';
type Draft = Record<Field, string>;

function toDraft(config: SyntheticPopulationConfig): Draft {
  return {
    desired: String(config.desired),
    capacityPerWorker: String(config.capacityPerWorker),
    leaseMs: String(config.leaseMs),
    actionIntervalMs: String(config.actionIntervalMs),
    sessionMs: String(config.sessionMs),
    preferredVersion: config.preferredVersion,
  };
}

export function useSyntheticPopulationConfiguration() {
  const [fields, setFields] = createSignal(
    toDraft(DEFAULT_SYNTHETIC_POPULATION_CONFIG)
  );
  let initialized = false;
  return {
    fields,
    initialize(config: SyntheticPopulationConfig) {
      if (initialized) return;
      initialized = true;
      setFields(toDraft(config));
    },
    change(field: Field, value: string) {
      setFields((previous) => ({ ...previous, [field]: value }));
    },
    candidate(
      config: SyntheticPopulationConfig | undefined
    ): SyntheticPopulationConfig | null {
      if (
        config === undefined ||
        numericFields.some((field) => !/^\d+$/.test(fields()[field]))
      )
        return null;
      const parsed = syntheticPopulationConfigSchema.safeParse({
        ...config,
        ...Object.fromEntries(
          numericFields.map((field) => [field, Number(fields()[field])])
        ),
        preferredVersion: fields().preferredVersion,
      });
      return parsed.success ? parsed.data : null;
    },
  };
}

export function SyntheticPopulationConfiguration(props: {
  fields: Draft;
  change: (field: Field, value: string) => void;
}): JSX.Element {
  const { t } = useLingui();
  const labels: Record<Field, string> = {
    desired: t`Desired synthetic population`,
    capacityPerWorker: t`Admission limit per worker`,
    leaseMs: t`Worker Lease duration (milliseconds)`,
    actionIntervalMs: t`UI action interval (milliseconds)`,
    sessionMs: t`Session duration (milliseconds)`,
    preferredVersion: t`Version accepting new assignments`,
  };
  return (
    <MenuSection
      title={<Trans>Configuration</Trans>}
      footer={
        <Trans>
          Capacity is bounded by each worker's resource limit. An empty version
          allows every healthy version to accept assignments.
        </Trans>
      }
    >
      <For each={[...numericFields, 'preferredVersion'] as const}>
        {(field) => (
          <TextInput
            label={labels[field]}
            type={field === 'preferredVersion' ? 'text' : 'number'}
            value={props.fields[field]}
            onChangeText={(value) => props.change(field, value)}
            dataSet={{
              testid:
                field === 'desired'
                  ? 'synthetic-population-desired-input'
                  : `synthetic-population-config-${field}`,
            }}
          />
        )}
      </For>
    </MenuSection>
  );
}
