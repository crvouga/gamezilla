/** @jsxImportSource solid-js */
/**
 * A vendor's own HTML page in the actor's browser: the payment provider's
 * hosted checkout and billing portal, the sign-in provider's screens. The
 * markup is the vendor's, as served; its scripts do not run (the pages work
 * without them, as the vendors' no-JavaScript paths do), and its forms submit
 * through the browser — a GET form loads its URL, a POST form posts its fields
 * — the way a browser submits them.
 */

import { type JSX, onCleanup, onMount } from 'solid-js';

import type { FormFields } from '../fabric/browser';
import {
  documentCss,
  HARNESS_BROWSER_PAGE_CLASS,
  scopePageCss,
} from './document-css';

export type DocumentPageProps = {
  readonly url: string;
  readonly html: string;
  readonly navigate: (url: string) => void;
  readonly post: (action: string, fields: FormFields) => void;
};

/** The page body's nodes, adopted into `into`'s document, scripts dropped. */
function bodyNodes(html: string, into: Document): Node[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const node of doc.querySelectorAll('script, style, noscript')) {
    node.remove();
  }
  return [...doc.body.childNodes].map((node) => into.importNode(node, true));
}

type Submitter = HTMLButtonElement | HTMLInputElement;

function isSubmitter(node: EventTarget): node is Submitter {
  if (node instanceof HTMLButtonElement) {
    return (node.getAttribute('type') ?? 'submit').toLowerCase() === 'submit';
  }
  return (
    node instanceof HTMLInputElement &&
    (node.type === 'submit' || node.type === 'image')
  );
}

/** The form a submit button submits: its own, or the one its `form` names. */
function formOf(button: Submitter, root: HTMLElement): HTMLFormElement | null {
  const named = button.getAttribute('form');
  if (named !== null) {
    const found = root.querySelector(`form#${CSS.escape(named)}`);
    return found instanceof HTMLFormElement ? found : null;
  }
  return button.closest('form');
}

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isControl(node: Element): node is Control {
  return (
    node instanceof HTMLInputElement ||
    node instanceof HTMLSelectElement ||
    node instanceof HTMLTextAreaElement
  );
}

/** One control's entry in the form data set, or `null` when it has none. */
function entryOf(control: Control): readonly [string, string] | null {
  const name = control.getAttribute('name');
  if (name === null || name === '' || control.disabled) return null;
  if (control instanceof HTMLInputElement) {
    const type = control.type;
    if (['submit', 'image', 'button', 'reset', 'file'].includes(type)) {
      return null;
    }
    if ((type === 'checkbox' || type === 'radio') && !control.checked) {
      return null;
    }
    const value = control.getAttribute('value');
    if ((type === 'checkbox' || type === 'radio') && value === null) {
      return [name, 'on'];
    }
  }
  return [name, control.value];
}

/**
 * The form data set, in tree order: every named control inside the form or
 * pointing at it by `form`, and the submitter's own name and value.
 */
function formFields(
  form: HTMLFormElement,
  submitter: Submitter,
  root: HTMLElement
): [string, string][] {
  const fields: [string, string][] = [];
  const id = form.getAttribute('id');
  const owned = [
    ...form.querySelectorAll('input, select, textarea, button'),
    ...(id === null
      ? []
      : root.querySelectorAll(
          `[form="${CSS.escape(id)}"]:is(input, select, textarea, button)`
        )),
  ];
  for (const node of owned) {
    if (node === submitter) {
      const name = submitter.getAttribute('name');
      if (name !== null && name !== '') fields.push([name, submitter.value]);
      continue;
    }
    if (!isControl(node)) continue;
    const entry = entryOf(node);
    if (entry !== null) fields.push([entry[0], entry[1]]);
  }
  return fields;
}

export function DocumentPage(props: DocumentPageProps): JSX.Element {
  let host!: HTMLDivElement;

  const submit = (form: HTMLFormElement, submitter: Submitter): void => {
    const target = new URL(
      submitter.getAttribute('formaction') ?? form.getAttribute('action') ?? '',
      props.url
    );
    const method = (
      submitter.getAttribute('formmethod') ??
      form.getAttribute('method') ??
      'get'
    ).toLowerCase();
    const fields = formFields(form, submitter, host);
    if (method === 'post') {
      props.post(target.href, fields);
      return;
    }
    target.search = new URLSearchParams(fields).toString();
    props.navigate(target.href);
  };

  const onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented || event.button !== 0) return;
    const button = event.composedPath().find(isSubmitter);
    if (button === undefined || button.disabled) return;
    const form = formOf(button, host);
    if (form === null) return;
    event.preventDefault();
    submit(form, button);
  };

  onMount(() => {
    const doc = host.ownerDocument;
    const nodes = bodyNodes(props.html, doc);
    const css = scopePageCss(documentCss(props.html));
    if (css !== '') {
      const style = doc.createElement('style');
      style.textContent = css;
      nodes.unshift(style);
    }
    host.replaceChildren(...nodes);
    host.addEventListener('click', onClick);
    onCleanup(() => host.removeEventListener('click', onClick));
  });

  return <div class={`${HARNESS_BROWSER_PAGE_CLASS} min-h-full`} ref={host} />;
}
