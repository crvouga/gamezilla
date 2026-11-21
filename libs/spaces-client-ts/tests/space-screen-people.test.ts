import { describe, expect, test } from 'bun:test';
import { spaceScreenPeople } from '@libs/spaces-client-ts/space-screen-people';

describe('spaceScreenPeople', () => {
  test('host first, the viewer marked, a quiet person away, art kept', () => {
    const people = spaceScreenPeople({
      faces: [
        { id: 'ana', name: 'ana', svg: undefined },
        { id: 'bob', name: 'bob', svg: '<svg/>' },
        { id: 'cy', name: null, svg: undefined },
      ],
      hostId: 'bob',
      myId: 'ana',
      idle: new Set(['cy']),
    });
    expect(people.map((person) => person.id)).toEqual(['bob', 'ana', 'cy']);
    expect(people[0]).toMatchObject({ host: true, you: false, svg: '<svg/>' });
    expect(people[1]).toMatchObject({ you: true, host: false, initials: 'A' });
    expect(people[2]).toMatchObject({
      kind: 'person',
      name: '',
      status: 'away',
      initials: undefined,
      tintKey: 'cy',
    });
  });
});
