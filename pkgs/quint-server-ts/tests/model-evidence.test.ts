import { describe, expect, test } from 'bun:test';
import type { Obligation } from '@pkgs/conformance-shared-ts/evidence';
import { decide, failureDetail } from '@pkgs/quint-server-ts/model-evidence';

function recorder() {
  const recorded: Obligation[] = [];
  return { recorded, record: (o: Obligation) => void recorded.push(o) };
}

describe('model evidence', () => {
  test('a decided obligation is recorded as a pass, with what it proved', async () => {
    const { recorded, record } = recorder();
    await decide({
      record,
      id: 'verify',
      layer: 'specification',
      body: async () => 'invA hold',
    });
    expect(recorded).toEqual([
      {
        id: 'verify',
        layer: 'specification',
        status: 'pass',
        detail: 'invA hold',
      },
    ]);
  });

  test('a failing obligation is recorded as a fail and still fails the test', async () => {
    const { recorded, record } = recorder();
    await expect(
      decide({
        record,
        id: 'trace:3',
        layer: 'implementation',
        body: () => {
          throw new Error('the product is not in the state the model reached');
        },
      })
    ).rejects.toThrow('the product is not in the state');
    expect(recorded).toEqual([
      {
        id: 'trace:3',
        layer: 'implementation',
        status: 'fail',
        detail: 'the product is not in the state the model reached',
      },
    ]);
  });

  test('a long failure is cut short in the evidence', () => {
    const detail = failureDetail(new Error('x'.repeat(5000)));
    expect(detail.length).toBe(2001);
    expect(detail.endsWith('…')).toBe(true);
  });
});
