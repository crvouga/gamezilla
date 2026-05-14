import type { AssistantAction } from '../../shared/_internal/action';
import type { AssistantRenderer } from '../../shared/_internal/renderer';

export function createNoopRenderer(): AssistantRenderer {
  return {
    render(_action: AssistantAction): void {
      // intentionally empty — tests / headless runs
    },
  };
}
