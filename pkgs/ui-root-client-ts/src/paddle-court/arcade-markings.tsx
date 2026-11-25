import type { JSX } from '@solidjs/web';
import styles from './arcade-markings.module.css';

/** Stationary markings on the court glass. The game pieces use the outer viewBox. */
export function ArcadeMarkings(): JSX.Element {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 600 400"
      preserveAspectRatio="none"
      aria-hidden="true"
      class={styles['glass']}
    >
      <path
        class={styles['rail']}
        d="M12 60 V24 L24 12 H576 L588 24 V60 M12 340 V376 L24 388 H576 L588 376 V340"
      />
      <path class={styles['net']} d="M300 16 V160 M300 240 V384" />
      <path
        class={styles['service']}
        d="M288 164 H312 L336 188 V212 L312 236 H288 L264 212 V188 Z"
      />
      <path
        class={styles['ticks']}
        d="M12 100 H20 M12 200 H28 M12 300 H20 M588 100 H580 M588 200 H572 M588 300 H580"
      />
    </svg>
  );
}
