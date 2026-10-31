import { PRODUCT_NAME } from '@libs/product-identity-shared-ts/product-identity';

export type BrowserApplicationStarter = {
  readonly load: () => Promise<unknown>;
  readonly recoverOnce: boolean;
  readonly recoveryAttempted: () => boolean;
  readonly markRecoveryAttempted: () => void;
  readonly clearRecoveryAttempted: () => void;
  readonly reload: () => void;
  readonly showFailure: (error: unknown) => void;
};

/** Recovers one transient dev-module failure, then exposes a permanent error. */
export async function startBrowserApplication(
  starter: BrowserApplicationStarter
): Promise<void> {
  try {
    await starter.load();
    starter.clearRecoveryAttempted();
  } catch (error) {
    if (starter.recoverOnce && !starter.recoveryAttempted()) {
      starter.markRecoveryAttempted();
      starter.reload();
      return;
    }
    starter.showFailure(error);
    throw error;
  }
}

/**
 * A short reference a person can quote: the build that failed plus a random
 * id for this one failure. Telemetry has not loaded at this layer, so the
 * build is what identifies the release; the id tells two reports apart.
 */
export function startupFailureReference(
  build: string,
  createId: () => string
): string {
  const release = build.length > 0 ? build.slice(0, 7) : 'unknown';
  return `${release}-${createId().replaceAll('-', '').slice(0, 8)}`;
}

function element<K extends keyof HTMLElementTagNameMap>(
  document: Document,
  tag: K,
  className: string,
  text: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

/**
 * Replaces an indefinitely spinning bootstrap shell with an actionable error.
 * Plain DOM in English: the app bundle (and its translations) failed to load.
 * Development names the Vite cause and the error; production says what to do.
 */
export function showBrowserStartupFailure(args: {
  readonly document: Document;
  readonly reload: () => void;
  readonly development: boolean;
  readonly reference: string;
  readonly error?: unknown;
}): void {
  const shell = args.document.querySelector<HTMLElement>(
    '[data-startup-shell]'
  );
  if (shell === null) return;

  shell.setAttribute('aria-label', `${PRODUCT_NAME} failed to start`);
  shell.classList.add('startup-shell-failed');

  const mark = element(args.document, 'span', 'startup-shell-mark', '!');
  mark.setAttribute('aria-hidden', 'true');
  const title = element(
    args.document,
    'strong',
    '',
    args.development
      ? `${PRODUCT_NAME} could not start`
      : `${PRODUCT_NAME} couldn’t open`
  );
  const guidance = element(
    args.document,
    'span',
    'startup-shell-guidance',
    args.development
      ? 'Vite may still be preparing the page.'
      : 'Something stopped the app from loading. Check your connection, then reload. Anything already saved on this device is kept.'
  );
  const parts: HTMLElement[] = [mark, title, guidance];
  if (args.development) {
    parts.push(
      element(
        args.document,
        'code',
        'startup-shell-detail',
        args.error instanceof Error
          ? args.error.message
          : String(args.error ?? 'Unknown startup error')
      )
    );
  }
  parts.push(
    element(
      args.document,
      'code',
      'startup-shell-detail',
      `Reference: ${args.reference}`
    )
  );
  const reload = element(
    args.document,
    'button',
    'startup-shell-reload',
    'Reload'
  );
  reload.type = 'button';
  reload.addEventListener('click', args.reload);
  parts.push(reload);

  shell.replaceChildren(...parts);
}
