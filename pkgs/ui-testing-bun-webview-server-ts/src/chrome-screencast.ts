/** A Chrome compositor frame and its presentation time in epoch seconds. */
export type ScreencastFrame = {
  readonly timestamp: number;
  readonly jpeg: string;
};

export type Screencast = {
  start(): Promise<void>;
  stop(): Promise<readonly ScreencastFrame[]>;
};

type FrameEvent = {
  readonly sessionId: number;
  readonly metadata: { readonly timestamp: number };
  readonly data: string;
};

function serializeCommands(view: Pick<Bun.WebView, 'cdp'>): Bun.WebView['cdp'] {
  let pending: Promise<unknown> = Promise.resolve();
  return <T>(method: string, params?: Record<string, unknown>) => {
    const result = pending.then(() => view.cdp<T>(method, params));
    pending = result.catch(() => undefined);
    return result;
  };
}

/** Subscribe only while recording. Encoding the review video happens after the timed run. */
export function chromeScreencast(
  view: EventTarget & Pick<Bun.WebView, 'cdp'>
): Screencast & Pick<Bun.WebView, 'cdp'> {
  const cdp = serializeCommands(view);
  let frames: ScreencastFrame[] = [];
  let error: Error | null = null;
  let bytes = 0;
  let subscription: AbortController | undefined;
  const receive = (frame: FrameEvent): void => {
    bytes += frame.data.length;
    if (bytes > 16 * 1024 * 1024)
      error ??= new Error('Browser recording exceeded 16 MiB');
    if (error === null)
      frames.push({ timestamp: frame.metadata.timestamp, jpeg: frame.data });
    void cdp('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(
      (cause: unknown) => {
        error ??= new Error('Chrome did not acknowledge the captured frame', {
          cause,
        });
      }
    );
  };
  return {
    cdp,
    async start() {
      frames = [];
      bytes = 0;
      error = null;
      subscription = new AbortController();
      view.addEventListener(
        'Page.screencastFrame',
        (event) => {
          if (event instanceof MessageEvent) receive(event.data as FrameEvent);
        },
        { signal: subscription.signal }
      );
      try {
        await cdp('Page.startScreencast', {
          format: 'jpeg',
          quality: 90,
          everyNthFrame: 1,
        });
      } catch (cause) {
        subscription?.abort();
        throw cause;
      }
    },
    async stop() {
      try {
        await cdp('Page.stopScreencast');
        if (error !== null) throw error;
        if (!frames.length)
          throw new Error('Chrome captured no browser frames');
        return frames;
      } finally {
        subscription?.abort();
        frames = [];
      }
    },
  };
}
