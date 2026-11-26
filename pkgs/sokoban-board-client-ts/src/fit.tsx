/** @jsxImportSource @solidjs/web */
import { Button } from '@pkgs/ui-root-client-ts/button';
import type { JSX } from '@solidjs/web';
import styles from './warehouse.module.css';

/** Appears inside the board while the camera is magnified. */
export function WarehouseFit(props: {
  label: string;
  onFit: () => void;
}): JSX.Element {
  return (
    <div class={styles['fit']}>
      <Button
        title={props.label}
        onClick={props.onFit}
        intent="neutral"
        variant="outline"
      />
    </div>
  );
}
