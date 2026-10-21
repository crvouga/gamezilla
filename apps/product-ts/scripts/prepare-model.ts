// @io-wall-ok — explicit model setup; never runs inside the offline gate.
import { setup } from '@pkgs/ui-quality-check-server-ts/api';
import { UI_QUALITY_MODEL_DIR } from './ui-quality/model-location';

if (import.meta.main) {
  const model = await setup({
    modelDir: UI_QUALITY_MODEL_DIR,
  });
  console.log(
    JSON.stringify({
      model: model.model,
      modelVersion: model.modelVersion,
      installed: model.installed,
    })
  );
}
