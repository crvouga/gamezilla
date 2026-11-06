import type {
  NumberlinkDefinition,
  NumberlinkState,
} from '@libs/numberlink-shared-ts/numberlink-types';
import { useLingui } from '@lingui/solid/macro';
import { Select } from '@pkgs/ui-root-client-ts/select';

/** One stable recovery control, regardless of how many paths are drawn. */
export function NumberlinkRecovery(props: {
  definition: NumberlinkDefinition;
  state: NumberlinkState;
  onAction: (action: string) => void;
}) {
  const { t } = useLingui();
  const options = () =>
    props.definition.pairs
      .filter((pair) =>
        props.state.paths.some((path) => path.pairId === pair.id)
      )
      .map((pair) => ({ value: pair.id, label: t`Remove path ${pair.label}` }));
  return (
    <Select
      aria-label={t`Remove a path`}
      placeholder={t`Remove a path`}
      surfaceTitle={t`Choose a path to remove`}
      value=""
      options={options()}
      disabled={options().length === 0}
      triggerDataSet={{ testid: 'numberlink-remove-path' }}
      onValueChange={(pairId) =>
        props.onAction(JSON.stringify({ pairId, cells: [] }))
      }
    />
  );
}
