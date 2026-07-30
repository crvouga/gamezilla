import { describe, expect, it } from 'bun:test';
import { projectEventLog } from '@pkgs/collab';
import { asKeyword } from '@pkgs/keyword';

import { MemberJoined, MemberLeft, SpaceRenamed } from './space-log-messages';
import { createSpaceEventLogRouter } from './space-log-router';

const router = createSpaceEventLogRouter();

describe('createSpaceEventLogRouter', () => {
  it('projects join/leave as verb-only text without member ids', () => {
    const memberId = '3834f541-619e-4a54-b4b8-c5724d17be53';
    const lines = projectEventLog(
      [
        {
          seq: 1,
          event: MemberJoined({ memberId }),
          actor: { id: memberId, clientId: 'c1' },
          ts: 100,
        },
        {
          seq: 2,
          event: MemberLeft({ memberId }),
          actor: { id: memberId, clientId: 'c1' },
          ts: 200,
        },
      ],
      router
    );
    expect(lines).toHaveLength(2);
    expect(String(lines[0]?.text)).toBe('joined');
    expect(String(lines[1]?.text)).toBe('left');
    expect(String(lines[0]?.text)).not.toContain(memberId);
    expect(String(lines[1]?.text)).not.toContain(memberId);
    expect(lines[0]?.icon).toBe('log-in');
    expect(lines[1]?.icon).toBe('log-out');
  });

  it('projects rename with square-pen icon', () => {
    const lines = projectEventLog(
      [
        {
          seq: 1,
          event: SpaceRenamed({ title: 'Party' }),
          actor: { id: 'a', clientId: 'c1' },
          ts: 100,
        },
      ],
      router
    );
    expect(lines).toHaveLength(1);
    expect(String(lines[0]?.text)).toContain('Party');
    expect(lines[0]?.icon).toBe('square-pen');
  });

  it('drops unknown events', () => {
    const lines = projectEventLog(
      [
        {
          seq: 1,
          event: {
            type: asKeyword('other-evt/unknown'),
            payload: {},
          },
          actor: { id: 'a', clientId: 'c1' },
          ts: 100,
        },
      ],
      router
    );
    expect(lines).toHaveLength(0);
  });
});
