import type { AssistantAction } from '../../shared/internal/action';
import type { AssistantRenderer } from '../../shared/internal/renderer';

export function createNoopRenderer(): AssistantRenderer {
  return {
    render(_action: AssistantAction): void {
      // intentionally empty — tests / headless runs
    },
  };
}
