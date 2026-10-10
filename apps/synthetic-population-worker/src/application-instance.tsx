import {
  authenticateThroughUi,
  configureUsername,
} from '@libs/synthetic-population-shared/application-actions';
import { redactDiagnostic } from '@libs/synthetic-population-shared/inspection';
import { createApplicationHost } from './application-host';
import type { RecordingInput } from './recorded-ui';

/** Called inside one isolated realm, never on a shared DOM or module graph. */
export async function createApplicationInstance(
  input: RecordingInput & {
    origin: string;
    deviceId: string;
    email: string;
    registered: boolean;
    username: string;
    route: string;
  }
) {
  const host = await createApplicationHost(input);
  try {
    await host.driver.launch();
    await authenticateThroughUi(host.driver, input);
    const token = await host.env.createAuthClient().getFreshToken();
    if (token === null)
      throw new Error('Normal authentication did not establish a session');
    let activation: Promise<void> | null = null;
    return {
      ...host,
      token,
      route: () => host.history.get(),
      // Profile and gameplay writes start only after backend ownership binding.
      activate() {
        activation ??= (async () => {
          await configureUsername(host.driver, input.username);
          host.history.set({ value: input.route, replace: true });
        })();
        return activation;
      },
    };
  } catch (error) {
    input.onError(
      redactDiagnostic(error instanceof Error ? error.message : String(error), [
        input.password,
      ]).slice(0, 512)
    );
    await host.close();
    throw error;
  }
}
