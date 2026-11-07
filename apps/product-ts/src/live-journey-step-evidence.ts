import { writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';

type Step = { readonly keyword: string; readonly text: string };

/** Only the browser operations needed for an opt-in successful-step capture. */
export type JourneyStepView = {
  evaluate(script: string): Promise<unknown>;
  screenshot(options: { encoding: 'buffer' }): Promise<Uint8Array>;
};

export type JourneyStepRecorder = <T>(
  step: Step,
  run: () => Promise<T>
) => Promise<T>;

/** Record successful steps in scenario order; disabled capture never touches the browser. */
export function createJourneyStepRecorder(
  scenarioId: string,
  store: ObjectStore | null,
  view: () => JourneyStepView | null
): JourneyStepRecorder {
  let sequence = 0;
  return async (step, run) => {
    const index = ++sequence;
    const result = await run();
    if (store === null) return result;
    const current = view();
    const key = `${scenarioId}/steps/${String(index).padStart(4, '0')}`;
    const screenshot = current === null ? null : `${key}.png`;
    let url: string | null = null;
    if (current !== null && screenshot !== null) {
      // Keep the route without credentials, query tokens or fragment values.
      const location = new URL(String(await current.evaluate('location.href')));
      url = `${location.origin}${location.pathname}`;
      await store.put(
        screenshot,
        await current.screenshot({ encoding: 'buffer' }),
        'image/png'
      );
    }
    await writeUtf8(
      store,
      `${key}.json`,
      JSON.stringify({
        scenarioId,
        index,
        action: `${step.keyword.trim()} ${step.text}`,
        status: 'passed',
        url,
        screenshot,
      })
    );
    return result;
  };
}
