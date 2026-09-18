/**
 * Just enough HTML to act like a browser on an identity provider's screens:
 * find the form, carry its hidden fields, type into its inputs, press one of
 * its buttons. Parsing the real markup (instead of knowing the provider's URL
 * shapes) is what keeps the headless path honest — if the provider changes a
 * screen, this notices.
 */

export type HeadlessButton = {
  readonly name: string;
  readonly value: string;
  /** Inner markup, used to recognise "the row with my email on it". */
  readonly content: string;
  readonly testId: string;
};

export type HeadlessForm = {
  readonly action: string;
  readonly method: 'get' | 'post';
  readonly hidden: Readonly<Record<string, string>>;
  readonly inputNames: readonly string[];
  readonly buttons: readonly HeadlessButton[];
};

function attr(tag: string, name: string): string {
  const match = new RegExp(`${name}="([^"]*)"`, 'i').exec(tag);
  return match?.[1] ?? '';
}

function decodeEntities(raw: string): string {
  return raw
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

function parseInputs(body: string): {
  readonly hidden: Record<string, string>;
  readonly inputNames: string[];
} {
  const hidden: Record<string, string> = {};
  const inputNames: string[] = [];
  for (const match of body.matchAll(/<input\b[^>]*>/gi)) {
    const tag = match[0];
    const name = attr(tag, 'name');
    if (name === '') continue;
    if (attr(tag, 'type').toLowerCase() === 'hidden') {
      hidden[name] = decodeEntities(attr(tag, 'value'));
      continue;
    }
    inputNames.push(name);
  }
  return { hidden, inputNames };
}

function parseButtons(body: string): HeadlessButton[] {
  const buttons: HeadlessButton[] = [];
  for (const match of body.matchAll(
    /<button\b([^>]*)>([\s\S]*?)<\/button>/gi
  )) {
    const tag = `<button${match[1] ?? ''}>`;
    buttons.push({
      name: attr(tag, 'name'),
      value: decodeEntities(attr(tag, 'value')),
      content: decodeEntities(match[2] ?? ''),
      testId: attr(tag, 'data-testid'),
    });
  }
  return buttons;
}

/** The first `<form>` on the page, the way a keyboard-only user would see it. */
export function parseFirstForm(html: string): HeadlessForm | null {
  const match = /<form\b([^>]*)>([\s\S]*?)<\/form>/i.exec(html);
  if (match === null) return null;
  const tag = `<form${match[1] ?? ''}>`;
  const body = match[2] ?? '';
  const { hidden, inputNames } = parseInputs(body);
  return {
    action: decodeEntities(attr(tag, 'action')),
    method: attr(tag, 'method').toLowerCase() === 'get' ? 'get' : 'post',
    hidden,
    inputNames,
    buttons: parseButtons(body),
  };
}

export function formSubmitBody(args: {
  readonly form: HeadlessForm;
  readonly typed: Readonly<Record<string, string>>;
  readonly button: HeadlessButton | null;
}): string {
  const params = new URLSearchParams(args.form.hidden);
  for (const name of args.form.inputNames) {
    const typed = args.typed[name];
    if (typed !== undefined) params.set(name, typed);
  }
  if (args.button !== null && args.button.name !== '') {
    params.set(args.button.name, args.button.value);
  }
  return params.toString();
}
