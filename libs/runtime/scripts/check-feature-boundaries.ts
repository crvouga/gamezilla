// @io-wall-ok — feature boundary CLI entry root (scripts/**).
import { assertTableBoundaries } from '@libs/feature/public/boundaries';
import { APP_FEATURES } from '../src/root/app-features';

await assertTableBoundaries(APP_FEATURES);
console.log(
  `feature table boundaries hold across ${String(APP_FEATURES.length)} features`
);
