import type { MutationBatchRequest } from '@pkgs/sync-engine-shared/v2';

/** Fault is applied after the real backend has accepted the ordinary move. */
export function lostMoveAcknowledgement() {
  let armed = false;
  let accepted: MutationBatchRequest['mutations'][number] | null = null;
  let attempts = 0;
  return {
    arm: () => {
      armed = true;
    },
    accepted: () => accepted,
    attempts: () => attempts,
    async observe(request: Request) {
      if (new URL(request.url).pathname !== '/api/mutations') return null;
      const body = (await request.clone().json()) as MutationBatchRequest;
      const move = body.mutations.find(
        (mutation) =>
          mutation.name === 'playMultiplayerMove' &&
          (accepted === null || mutation.id === accepted.id)
      );
      if (move === undefined) return null;
      if (accepted?.id === move.id) attempts += 1;
      return armed ? move : null;
    },
    disrupt(
      move: MutationBatchRequest['mutations'][number] | null,
      response: Response
    ) {
      if (!armed || move === null || !response.ok) return response;
      armed = false;
      accepted = move;
      attempts = 1;
      return new Response('Connection interrupted after acceptance', {
        status: 503,
      });
    },
  };
}
