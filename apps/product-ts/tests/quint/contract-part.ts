/** `k/n` names one symbolic model. Empty runs the whole suite. */
export type ContractPart = {
  readonly index: number;
  readonly count: number;
};

const PART = /^(\d+)\/(\d+)$/;

/** Parse `CONTRACT_PART`. Empty is the whole suite; anything else must be `k/n`. */
export function contractPart(raw: string): ContractPart | null {
  const text = raw.trim();
  if (text.length === 0) return null;
  const match = PART.exec(text);
  if (match === null) throw new Error(`CONTRACT_PART=${raw} must be k/n`);
  const index = Number(match[1]);
  const count = Number(match[2]);
  if (count < 1 || index >= count) {
    throw new Error(`CONTRACT_PART=${raw} is outside 0..n-1`);
  }
  return { index, count };
}

/**
 * The models one contract task proves. A part count other than the suite
 * length would drop a model, so it fails instead of proving a subset.
 */
export function modelsForContractPart<T>(
  models: readonly T[],
  part: ContractPart | null
): readonly T[] {
  if (part === null) return models;
  if (part.count !== models.length) {
    throw new Error(
      `CONTRACT_PART ${String(part.index)}/${String(part.count)} does not match ${String(models.length)} models`
    );
  }
  const model = models[part.index];
  if (model === undefined) {
    throw new Error(`CONTRACT_PART has no model ${String(part.index)}`);
  }
  return [model];
}
