/** `specs/runtime/declared-environment.feature`. */
import { verifyDeclaredEnvironment } from '../../../../libs/infra-server/scripts/drift-verify';
import { Then } from './define';

Then('this environment is exactly as the team planned it', async () => {
  await verifyDeclaredEnvironment();
});
