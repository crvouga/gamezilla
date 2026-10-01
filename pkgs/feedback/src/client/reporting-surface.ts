import type { FeedbackReport, CreatedIssue } from '../shared/types';

export function createReportingSurface(host: HTMLElement) {
  const shadow = host.attachShadow({ mode: 'open' });
  // Static markup only: user text is always assigned through value/textContent.
  shadow.innerHTML = `<style>
    :host { position:fixed; right:12px; bottom:12px; z-index:2147483647; font:16px system-ui; color:#111 }
    button,a { font:inherit; cursor:pointer } button { padding:10px; border:1px solid #777; border-radius:6px; background:#fff; color:#111 }
    dialog { border:1px solid #777; border-radius:8px; padding:20px; width:min(420px,80vw); background:#fff; color:#111 }
    dialog::backdrop { background:#0007 } h2 { margin-top:0 } label { display:block; margin:12px 0 }
    input,textarea { display:block; box-sizing:border-box; width:100%; margin-top:4px; font:inherit; padding:8px }
    textarea { min-height:100px } .actions { display:flex; gap:10px; flex-wrap:wrap } p { overflow-wrap:anywhere }
    [hidden] { display:none !important }
  </style>
  <button type="button" data-testid="report-bug-open">Support</button>
  <dialog aria-labelledby="bug-title" data-component="RootFeedbackReporting">
    <form><h2 id="bug-title">Support</h2>
      <label>Title<input name="title" maxlength="240" data-testid="report-bug-title"></label>
      <label>Description<textarea name="description" maxlength="32000" data-testid="report-bug-description"></textarea></label>
      <div class="actions"><button type="submit" data-testid="report-bug-submit">Save report</button><button type="button" name="close">Close</button></div>
      <p role="status" aria-live="polite"></p>
      <label hidden>Emergency copy<textarea name="emergency" readonly></textarea></label>
      <a href="/report-bug" target="_blank" rel="noopener">Open separate reporting page</a>
    </form>
  </dialog>`;
  function element<T extends Element>(selector: string): T {
    const node = shadow.querySelector<T>(selector);
    if (node === null) throw new Error('Reporting surface is incomplete');
    return node;
  }
  const dialog = element<HTMLDialogElement>('dialog');
  const form = element<HTMLFormElement>('form');
  const title = element<HTMLInputElement>('input');
  const description = element<HTMLTextAreaElement>(
    'textarea[name="description"]'
  );
  const submit = element<HTMLButtonElement>('button[type="submit"]');
  const status = element<HTMLParagraphElement>('[role="status"]');
  const emergency = element<HTMLTextAreaElement>('[name="emergency"]');
  const open = () => {
    if (dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    title.focus();
  };
  element<HTMLButtonElement>(
    '[data-testid="report-bug-open"]'
  ).addEventListener('click', open);
  element<HTMLButtonElement>('[name="close"]').addEventListener('click', () =>
    dialog.close()
  );
  return {
    form,
    title,
    description,
    open,
    pending(): void {
      submit.disabled = true;
      status.textContent = 'Saving report…';
    },
    saved(issue: CreatedIssue): void {
      submit.disabled = false;
      status.textContent = `Report saved: ${issue.url ?? issue.location ?? issue.id}`;
    },
    failed(report: FeedbackReport): void {
      submit.disabled = false;
      status.textContent =
        'Report could not be sent. Keep this emergency copy and submit again when the connection returns.';
      emergency.value = JSON.stringify(report, null, 2);
      emergency.parentElement?.removeAttribute('hidden');
    },
  };
}
