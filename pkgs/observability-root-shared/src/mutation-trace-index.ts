export interface MutationTraceIndex {
  findTraceIds(mutationId: string): Promise<readonly string[]>;
}
