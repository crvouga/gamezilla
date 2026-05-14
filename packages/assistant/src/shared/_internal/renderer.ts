import type { AssistantAction } from './action';

export type AssistantRenderer = {
  render(action: AssistantAction): void;
};
