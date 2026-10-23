import { resolve } from 'node:path';

/** Shared location of the explicitly installed visual-quality model. */
export const UI_QUALITY_MODEL_DIR = resolve(
  import.meta.dir,
  '../../../../.cache/ui-quality-model'
);
