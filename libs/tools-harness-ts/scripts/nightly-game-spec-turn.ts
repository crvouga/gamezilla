const GAME_SPEC = /^@libs\/games-harness-ts#test:spec:(\d+)$/;
export const GAME_SPEC_NIGHTS = 4;

/** A workflow retry takes the same turn even if runner admission crosses midnight. */
export function nightlyGameSpecTurn(createdAt: string) {
  const day = Math.floor(Date.parse(createdAt) / 86_400_000);
  if (!Number.isSafeInteger(day) || day < 0)
    throw new Error('Missing or invalid Nightly creation timestamp');
  const turn = day % GAME_SPEC_NIGHTS;
  return {
    turn,
    includes(taskId: string): boolean {
      const part = GAME_SPEC.exec(taskId);
      return !part || Number(part[1]) % GAME_SPEC_NIGHTS === turn;
    },
  };
}
