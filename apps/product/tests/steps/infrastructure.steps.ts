/** `specs/runtime/declared-environment.feature`. */
import { checkDeclaredEnvironment } from '@libs/infra/scripts/drift-check';
import { Then } from './define';

Then('this environment is exactly as the team planned it', async () => {
  await checkDeclaredEnvironment();
});
