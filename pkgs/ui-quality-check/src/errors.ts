import type { BatchQualityResult, QualityResult } from './types';

export class UIQualityError extends Error {
  override readonly name = 'UIQualityError';
  constructor(readonly result: QualityResult | BatchQualityResult) {
    super(result.summary);
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
