/** Durable execution progress shared by game capabilities; validation belongs to the product boundary. */
export type SimulationExecution = {
  readonly epoch: string;
  readonly generation: number;
  readonly inputGeneration: number;
  readonly tick: number;
  readonly acknowledged: Readonly<Record<string, number>>;
  readonly phase:
    | 'countdown'
    | 'running'
    | 'paused'
    | 'completed'
    | 'abandoned';
  readonly started: boolean;
  readonly missing: readonly ('white' | 'black')[];
  readonly expiresAt: number | null;
};
