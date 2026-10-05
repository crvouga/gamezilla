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

/** Replaces an indefinitely spinning bootstrap shell with an actionable error. */
export function showBrowserStartupFailure(args: {
  readonly document: Document;
  readonly reload: () => void;
  readonly error?: unknown;
}): void {
  const shell = args.document.querySelector<HTMLElement>(
    '[data-startup-shell]'
  );
  if (shell === null) return;

  shell.setAttribute('aria-label', 'Gamezilla failed to start');
  shell.classList.add('startup-shell-failed');

  const mark = args.document.createElement('span');
  mark.className = 'startup-shell-mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = '!';

  const title = args.document.createElement('strong');
  title.textContent = 'Gamezilla could not start';

  const guidance = args.document.createElement('span');
  guidance.className = 'startup-shell-guidance';
  guidance.textContent = 'Vite may still be preparing the page.';

  const detail = args.document.createElement('code');
  detail.className = 'startup-shell-detail';
  detail.textContent =
    args.error instanceof Error
      ? args.error.message
      : String(args.error ?? 'Unknown startup error');

  const reload = args.document.createElement('button');
  reload.className = 'startup-shell-reload';
  reload.type = 'button';
  reload.textContent = 'Reload';
  reload.addEventListener('click', args.reload);

  shell.replaceChildren(mark, title, guidance, detail, reload);
}
