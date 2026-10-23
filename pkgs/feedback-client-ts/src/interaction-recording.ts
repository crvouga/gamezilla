import type { ReproductionAction } from '@pkgs/feedback-shared-ts/types';
import type { createReproductionRecorder } from './recording';

function privateElement(element: Element): boolean {
  return (
    element.closest('[data-feedback-root], [data-feedback-private]') !== null ||
    /password|email|tel|hidden/i.test(element.getAttribute('type') ?? '') ||
    /password|token|secret|email|code/i.test(
      `${element.getAttribute('name') ?? ''} ${element.getAttribute('autocomplete') ?? ''}`
    )
  );
}

export function feedbackInteraction(
  event: Event,
  path: string
): Omit<ReproductionAction, 'atMs'> | null {
  if (!(event.target instanceof Element) || privateElement(event.target))
    return null;
  const target = event.target.closest(
    '[data-testid], [data-square], button, input, textarea, select, a, [role="button"]'
  );
  if (!target || privateElement(target)) return null;
  const square = target.getAttribute('data-square');
  const pointer = event.type === 'pointerdown' || event.type === 'pointerup';
  if (!recordableKey(event)) return null;
  if (event.type === 'click' && square) return null;
  const testId = target.getAttribute('data-testid');
  const label = interactionLabel(event, target);
  const selector = testId
    ? `[data-testid=${JSON.stringify(testId)}]`
    : square
      ? `[data-square=${JSON.stringify(square)}]`
      : `role=${target.getAttribute('role') ?? target.tagName.toLowerCase()};name=${label}`;
  const value =
    event instanceof KeyboardEvent
      ? event.key
      : event.type === 'input' && 'value' in target
        ? String(target.value).slice(0, 500)
        : null;
  return {
    type: event.type as ReproductionAction['type'],
    path,
    target: selector,
    label: square ?? label,
    value,
    point:
      pointer && event instanceof PointerEvent
        ? relativePoint(event, target)
        : null,
  };
}

/** No activity listeners exist until the person explicitly starts recording. */
export function installInteractionRecording(options: {
  readonly document: Document;
  readonly path: () => string;
  readonly recorder: ReturnType<typeof createReproductionRecorder>;
}): () => void {
  let installed = false;
  const events = [
    'click',
    'input',
    'pointerdown',
    'pointerup',
    'keydown',
  ] as const;
  const record = (event: Event) => {
    const action = feedbackInteraction(event, options.path());
    if (action) options.recorder.record(action);
  };
  const sync = () => {
    const shouldInstall = options.recorder.state().phase === 'recording';
    if (installed === shouldInstall) return;
    installed = shouldInstall;
    for (const event of events) {
      if (installed) options.document.addEventListener(event, record, true);
      else options.document.removeEventListener(event, record, true);
    }
  };
  const unsubscribe = options.recorder.subscribe(sync);
  return () => {
    unsubscribe();
    for (const event of events)
      options.document.removeEventListener(event, record, true);
  };
}

function relativePoint(
  event: PointerEvent,
  target: Element
): { x: number; y: number } | null {
  const frame = target.getBoundingClientRect();
  if (!frame.width || !frame.height) return null;
  return {
    x:
      Math.round(((event.clientX - frame.left) / frame.width) * 10_000) /
      10_000,
    y:
      Math.round(((event.clientY - frame.top) / frame.height) * 10_000) /
      10_000,
  };
}

function recordableKey(event: Event): boolean {
  if (event.type !== 'keydown') return true;
  return (
    event instanceof KeyboardEvent &&
    [
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'Enter',
      'Escape',
      ' ',
    ].includes(event.key)
  );
}

function interactionLabel(event: Event, target: Element): string {
  return (
    target.getAttribute('aria-label') ??
    (event.type === 'input'
      ? target.getAttribute('name')
      : target.textContent) ??
    ''
  )
    .trim()
    .slice(0, 120);
}
