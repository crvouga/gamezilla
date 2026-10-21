export interface SnapshotRenderer {
  render(html: string): Promise<Uint8Array>;
  dispose(): void;
}

/** Apply the report's local stylesheet; snapshot scripts and network assets never execute. */
export function snapshotDocument(html: string, css: string): string {
  const clean = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    .replace(/<meta\b[^>]*http-equiv\s*=[^>]*>/gi, '');
  const head = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:; script-src 'none'">`;
  const styles = `<style>${css.replace(/<\/style/gi, '<\\/style')}\n*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}</style>`;
  if (!/<\/head>/i.test(clean))
    throw new Error('Recorded HTML lacks a document head.');
  return clean.replace(/<\/head>/i, `${head}${styles}</head>`);
}

interface DocumentContext {
  prefix?: string;
  suffix?: string;
}

async function writeSnapshot(
  view: Bun.WebView,
  document: { readonly html: string; readonly frameId: string },
  context: DocumentContext
): Promise<void> {
  const parts = document.html.match(
    /^([\s\S]*?<body\b[^>]*>)([\s\S]*?)(<\/body\s*>[\s\S]*)$/i
  );
  const body = parts?.[2];
  const reusable =
    body !== undefined &&
    !/<\/?(?:html|body|head)\b|\sautofocus(?:[\s=>])/i.test(body);
  if (
    reusable &&
    context.prefix === parts![1] &&
    context.suffix === parts![3]
  ) {
    await view.evaluate(
      `(() => { document.body.innerHTML = ${JSON.stringify(body)}; return true; })()`
    );
  } else {
    await view.cdp('Page.setDocumentContent', document);
  }
  if (reusable) {
    context.prefix = parts![1]!;
    context.suffix = parts![3]!;
  } else {
    delete context.prefix;
    delete context.suffix;
  }
}

export function openSnapshotRenderer(
  css: string,
  signal?: AbortSignal,
  concurrency = 4
): SnapshotRenderer {
  signal?.throwIfAborted();
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8)
    throw new Error('Snapshot concurrency must be an integer from 1 to 8.');
  const pages = Array.from({ length: concurrency }, () =>
    openPage(css, signal)
  );
  let next = 0;
  return {
    render(html) {
      const page = pages[next++ % pages.length]!;
      return page.render(html);
    },
    dispose() {
      for (const page of pages) page.dispose();
    },
  };
}

function openPage(css: string, signal?: AbortSignal): SnapshotRenderer {
  const view = new Bun.WebView({
    width: 390,
    height: 844,
    backend: {
      type: 'chrome',
      url: false,
      argv: [
        '--headless=new',
        '--disable-background-networking',
        '--disable-component-update',
      ],
    },
  });
  const stop = () => view.close();
  signal?.addEventListener('abort', stop, { once: true });
  let ready: Promise<string> | undefined;
  let pending: Promise<unknown> = Promise.resolve();
  const context: DocumentContext = {};
  function initialize(): Promise<string> {
    return (ready ??= (async () => {
      await view.navigate('about:blank');
      // Window bounds are clamped by Chrome; emulation pins the actual viewport.
      await view.cdp('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await view.cdp('Network.enable');
      await view.cdp('Network.setBlockedURLs', {
        urls: ['http://*', 'https://*', 'file://*'],
      });
      const tree = (await view.cdp('Page.getFrameTree')) as {
        frameTree: { frame: { id: string } };
      };
      return tree.frameTree.frame.id;
    })());
  }
  async function render(html: string): Promise<Uint8Array> {
    signal?.throwIfAborted();
    await writeSnapshot(
      view,
      {
        frameId: await initialize(),
        html: snapshotDocument(html, css),
      },
      context
    );
    await view.evaluate(`(async () => {
        await document.fonts.ready;
        await Promise.all(Array.from(document.images, image => image.decode()));
        if (!document.body || !document.body.textContent.trim()) throw new Error('Recorded UI is blank.');
        return true;
      })()`);
    const screenshot = (await view.cdp('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
      clip: { x: 0, y: 0, width: 390, height: 844, scale: 1 },
    })) as { data: string };
    return new Uint8Array(Buffer.from(screenshot.data, 'base64'));
  }
  return {
    render(html) {
      const result = pending.then(() => render(html));
      pending = result.catch(() => {});
      return result;
    },
    dispose() {
      signal?.removeEventListener('abort', stop);
      view.close();
    },
  };
}
