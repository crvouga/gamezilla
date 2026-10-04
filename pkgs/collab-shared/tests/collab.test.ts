import { describe, expect, it } from 'bun:test';
import { asLocalized } from '@pkgs/i18n-shared/localized-string';
import { asKeyword } from '@pkgs/keyword-shared/keyword';
import { createMessageNamespace } from '@pkgs/message-shared/message';
import { createMessageRouter } from '@pkgs/message-shared/router';
import { deriveAttribution } from '@pkgs/collab-shared/derive-attribution';
import type { LogLineContext, LogLineDraft } from '@pkgs/collab-shared/log-line';
import { projectEventLog } from '@pkgs/collab-shared/project-event-log';
import {
  assignParticipantColors,
  resolveParticipantColor,
} from '@pkgs/collab-shared/participant-color';
import { groupRosterByParticipant } from '@pkgs/collab-shared/group-roster';

const demoNs = createMessageNamespace('demo-evt');
const Renamed = demoNs('renamed', (p): p is { title: string } => {
  return (
    typeof p === 'object' &&
    p !== null &&
    typeof (p as { title?: unknown }).title === 'string'
  );
});
const Ignored = demoNs('ignored', (_p): _p is Record<string, never> => true);

const router = createMessageRouter<void, LogLineContext, LogLineDraft | null>(
  demoNs
)
  .on(Renamed, (_s, _ctx, msg) => ({
    text: asLocalized(`renamed to ${msg.payload.title}`),
    targetKeys: ['space/title'],
  }))
  .on(Ignored, () => null);

describe('projectEventLog', () => {
  it('projects described events and drops null drafts', () => {
    const lines = projectEventLog(
      [
        {
          seq: 1,
          event: Renamed({ title: 'Party' }),
          actor: { id: 'a', clientId: 'c1' },
          ts: 100,
        },
        {
          seq: 2,
          event: Ignored({}),
          actor: { id: 'a', clientId: 'c1' },
          ts: 200,
        },
        {
          seq: 3,
          event: {
            type: asKeyword('other-evt/unknown'),
            payload: {},
          },
          actor: { id: 'b', clientId: 'c2' },
          ts: 300,
        },
      ],
      router
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]?.seq).toBe(1);
    expect(lines[0]?.text).toBe(asLocalized('renamed to Party'));
    expect(lines[0]?.targetKeys).toEqual(['space/title']);
  });
});

describe('deriveAttribution', () => {
  it('keeps the last actor per target key', () => {
    const map = deriveAttribution([
      {
        seq: 1,
        ts: 10,
        actor: { id: 'a', clientId: 'c1' },
        targetKeys: ['space/title', 'games/selected'],
      },
      {
        seq: 2,
        ts: 20,
        actor: { id: 'b', clientId: 'c2' },
        targetKeys: ['space/title'],
      },
    ]);
    expect(map.get('space/title')?.actor.id).toBe('b');
    expect(map.get('space/title')?.seq).toBe(2);
    expect(map.get('games/selected')?.actor.id).toBe('a');
  });
});

describe('participant colors', () => {
  it('is deterministic for a single key', () => {
    expect(resolveParticipantColor('alice').css).toBe(
      resolveParticipantColor('alice').css
    );
  });

  it('de-collides within a room', () => {
    const keys = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
    const map = assignParticipantColors(keys);
    const indexes = [...map.values()].map((c) => c.paletteIndex);
    expect(new Set(indexes).size).toBe(keys.length);
  });
});

describe('groupRosterByParticipant', () => {
  it('groups clients and marks isYou', () => {
    const grouped = groupRosterByParticipant(
      [
        { id: 'alice', clientId: 't1' },
        { id: 'bob', clientId: 't2' },
        { id: 'alice', clientId: 't3' },
      ],
      't3'
    );
    expect(grouped).toHaveLength(2);
    expect(grouped[0]?.id).toBe('alice');
    expect(grouped[0]?.clientCount).toBe(2);
    expect(grouped[0]?.isYou).toBe(true);
    expect(grouped[1]?.id).toBe('bob');
    expect(grouped[1]?.isYou).toBe(false);
  });
});
