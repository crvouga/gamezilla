import { createEffect, createMemo, on } from 'solid-js';

/** Move into a newly opened stage; writing updates keep the current caret. */
export function useStageFocus(
  host: () => HTMLElement | undefined,
  stage: () => string
) {
  const currentStage = createMemo(stage);
  createEffect(
    on(currentStage, (current) => {
      const selector =
        current === 'manage'
          ? 'input[type="search"]'
          : current === 'read'
            ? '[aria-label="Edit issue"]'
            : 'input[name="title"]';
      host()?.querySelector<HTMLElement>(selector)?.focus();
    })
  );
}
