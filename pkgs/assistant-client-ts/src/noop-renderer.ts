import type { AssistantAction } from '@pkgs/assistant-shared-ts/action';
import type { AssistantRenderer } from '@pkgs/assistant-shared-ts/renderer';

export function createNoopRenderer(): AssistantRenderer {
  return {
    render(_action: AssistantAction): void {
      // intentionally empty — tests / headless runs
    },
  };
}
