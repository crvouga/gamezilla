import type { TtsSynthesizeResponse } from '@pkgs/tts-root-shared/tts-types';

/** Aborted synthesis may still resolve from a cache or an uncancellable transport. */
export async function playSynthesized<
  Request extends { readonly signal: AbortSignal },
>(
  request: Request,
  synthesize: (request: Request) => Promise<TtsSynthesizeResponse>,
  onReady: (result: TtsSynthesizeResponse) => Promise<void>
): Promise<void> {
  const result = await synthesize(request);
  if (request.signal.aborted) return;
  await onReady(result);
}
