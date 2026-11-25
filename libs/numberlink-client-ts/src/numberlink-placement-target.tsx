import type { EndpointPair } from '@libs/numberlink-shared-ts/numberlink-types';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { P } from '@pkgs/ui-root-client-ts/text';

/** Connect the editor's endpoint choice to its visible and named board cell. */
export function NumberlinkPlacementTarget(props: {
  pair: EndpointPair;
  endpoint: 0 | 1;
}) {
  const coordinate = () => {
    const cell = props.pair.endpoints[props.endpoint];
    return `${String.fromCharCode(65 + cell.x)}${cell.y + 1}`;
  };
  return (
    <P
      variant="caption"
      aria-live="polite"
      dataSet={{ testid: 'numberlink-placement-target' }}
    >
      <Trans>
        Pair {props.pair.label} at {coordinate()}. Choose an empty cell to move
        it.
      </Trans>
    </P>
  );
}
