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

export function openSnapshotRenderer(
  css: string,
  signal?: AbortSignal
): SnapshotRenderer {
  signal?.throwIfAborted();
  const view = new Bun.WebView({
    width: 390,
    height: 844,
    backend: {
      type: 'chrome',
      url: false,
      argv: ['--disable-background-networking', '--disable-component-update'],
    },
  });
  const stop = () => view.close();
  signal?.addEventListener('abort', stop, { once: true });
  return {
    async render(html) {
      signal?.throwIfAborted();
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
      await view.cdp('Page.setDocumentContent', {
        frameId: tree.frameTree.frame.id,
        html: snapshotDocument(html, css),
      });
      await view.evaluate(`(async () => {
        await document.fonts.ready;
        await Promise.all(Array.from(document.images, image => image.decode()));
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (!document.body || !document.body.textContent.trim()) throw new Error('Recorded UI is blank.');
        return true;
      })()`);
      const screenshot = (await view.cdp('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
        clip: { x: 0, y: 0, width: 390, height: 844, scale: 1 },
      })) as { data: string };
      return new Uint8Array(Buffer.from(screenshot.data, 'base64'));
    },
    dispose() {
      signal?.removeEventListener('abort', stop);
      view.close();
    },
  };
}
