/** Keep HTTP cancellation attached until the response body finishes. */
export function trackAbortableResponse(
  response: Response,
  signal: AbortSignal,
  release: () => void
): Response {
  if (response.body === null) {
    release();
    return response;
  }
  const reader = response.body.getReader();
  let finished = false;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    signal.removeEventListener('abort', abort);
    release();
  };
  let streamController: ReadableStreamDefaultController<Uint8Array>;
  const abort = (): void => {
    if (finished) return;
    streamController.error(
      signal.reason ?? new DOMException('The request was aborted', 'AbortError')
    );
    finish();
    void reader.cancel().catch(() => undefined);
  };
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) abort();
    },
    async pull(controller) {
      try {
        const result = await reader.read();
        if (finished) return;
        if (result.done) {
          finish();
          controller.close();
        } else controller.enqueue(result.value);
      } catch (error) {
        if (finished) return;
        finish();
        controller.error(error);
      }
    },
    async cancel(reason) {
      finish();
      await reader.cancel(reason);
    },
  });
  const tracked = new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
  for (const key of ['url', 'redirected', 'type'] as const) {
    Object.defineProperty(tracked, key, { value: response[key] });
  }
  return tracked;
}
