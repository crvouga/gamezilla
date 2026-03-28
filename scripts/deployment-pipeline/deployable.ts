import type { StackOutputs } from './cdk-outputs';

export interface Deployable {
  readonly id: string;
  deploy(outputs: StackOutputs): void;
}
