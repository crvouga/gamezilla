import { createAgent, registerTools } from '@ui-sdk/solid/agent';

export function registerUiAgentTools(): () => void {
  return registerTools(createAgent(), { allow: (step) => !step.confirm });
}
