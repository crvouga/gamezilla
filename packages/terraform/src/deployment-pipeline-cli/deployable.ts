import type { TfOutputs } from './tf-outputs';

export interface Deployable {
  readonly id: string;
  deploy(outputs: TfOutputs): void;
}
