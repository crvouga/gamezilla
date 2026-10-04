// @io-wall-ok — explicit model setup; never runs inside the offline gate.
import { resolve } from 'node:path';
import { setup } from '@pkgs/ui-quality-check-server/api';

if (import.meta.main) {
  const model = await setup({
    modelDir: resolve(import.meta.dir, '../../../../.cache/ui-quality-model'),
  });
  console.log(
    JSON.stringify({
      model: model.model,
      modelVersion: model.modelVersion,
      installed: model.installed,
    })
  );
}
