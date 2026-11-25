import { type JSX, render } from '@solidjs/web';
import { createAgent, registerTools } from '@ui-sdk/solid/agent';
import { onCleanup } from 'solid-js';

export function registerUiAgentTools(): () => void {
  if (typeof document === 'undefined' || !('modelContext' in document))
    return () => undefined;
  return registerTools(createAgent(), { allow: (step) => !step.confirm });
}

export function renderApplication(
  root: () => JSX.Element,
  host: HTMLElement
): () => void {
  return render(() => {
    onCleanup(registerUiAgentTools());
    return root();
  }, host);
}
