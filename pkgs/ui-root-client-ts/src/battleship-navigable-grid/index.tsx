import { t } from '@lingui/core/macro';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createSignal, onCleanup, Show } from 'solid-js';
import { Button } from '../button';
import { CellGridBoard, type CellGridBoardProps } from '../cell-grid-board';
import { bindGrid } from './bind';
import { FIT } from './camera';
import type { ShipDrag } from './contact';
import styles from './surface.module.css';

type GridProps = CellGridBoardProps & {
  passive?: boolean;
  pickup?: ((cell: string) => ShipDrag | undefined) | undefined;
};
export function BattleshipNavigableGrid(props: GridProps) {
  return (
    <Show when={!props.passive} fallback={<CellGridBoard {...props} />}>
      <InteractiveGrid {...props} />
    </Show>
  );
}
function InteractiveGrid(props: GridProps) {
  let dispose: (() => void) | undefined;
  onCleanup(() => dispose?.());
  const [view, setView] = createSignal(FIT);
  return (
    <div
      class={styles['shell']}
      data-fill={String(!!props.fill)}
      style={{ '--columns': props.columnLabels.length }}
      {...dataAttrs({ component: 'BattleshipNavigableGrid' })}
    >
      <div
        class={styles['viewport']}
        data-battle-viewport=""
        data-scale={view().scale}
        ref={(root) => {
          dispose = bindGrid(root, {
            view,
            setView,
            pickup: (cell) => props.pickup?.(cell),
          });
        }}
      >
        <div
          class={styles['plane']}
          style={{
            transform:
              view().scale === 1
                ? 'none'
                : `translate(${view().x}px,${view().y}px) scale(${view().scale})`,
          }}
        >
          <CellGridBoard {...props} />
        </div>
      </div>
      <Show when={view().scale > 1}>
        <Button
          title={t`Fit board`}
          size="sm"
          variant="outline"
          onClick={() => setView(FIT)}
        />
      </Show>
    </div>
  );
}
