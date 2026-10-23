import { emitBusinessEvent } from './business-event';
import { defineEvent } from './event-contract';

export const WEB_VITAL_EVENT = defineEvent({
  name: 'browser.performance.measured',
  version: 1,
  owner: 'browser',
  description: 'A final Web Vital measurement for a page lifecycle.',
  delivery: 'best_effort',
  attributes: {
    'web_vital.name': {
      type: 'string',
      required: true,
      values: ['inp', 'lcp', 'cls'],
    },
    'web_vital.value': { type: 'number', required: true, minimum: 0 },
    'web_vital.unit': { type: 'string', required: true, values: ['ms', '1'] },
  },
});

export function recordWebVital(
  input: {
    readonly name: 'inp' | 'lcp' | 'cls';
    readonly value: number;
    readonly id: string;
  },
  now: () => number
): void {
  emitBusinessEvent(
    WEB_VITAL_EVENT,
    {
      'web_vital.name': input.name,
      'web_vital.value': input.value,
      'web_vital.unit': input.name === 'cls' ? '1' : 'ms',
    },
    { id: `${input.name}:${input.id}`, occurredAtMs: now() }
  );
}
