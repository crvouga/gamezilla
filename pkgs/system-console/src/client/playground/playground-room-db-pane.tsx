import { useTimers } from '@pkgs/clock';
import { Box, EmptyState, ScrollView, Text } from '@pkgs/ui';
import { type ReactNode, useEffect, useState } from 'react';

import type { PlaygroundRoomNode } from '../../shared/ports';

/**
 * Room state / event-log inspector (in-memory storage, not SQL).
 */
export function PlaygroundRoomDbPane(props: {
  readonly room: PlaygroundRoomNode;
  readonly subscribe: (listener: () => void) => () => void;
}) {
  const { room, subscribe } = props;
  const timers = useTimers();
  const [snap, setSnap] = useState(() => room.inspect());

  useEffect(() => {
    const refresh = () => setSnap(room.inspect());
    refresh();
    const unsub = subscribe(refresh);
    const handle = timers.setInterval(refresh, 500);
    return () => {
      unsub();
      timers.clearInterval(handle);
    };
  }, [room, subscribe, timers]);

  if (snap === null) {
    return (
      <Box sx={{ flex: 1, minHeight: 0, padding: 8 }}>
        <EmptyState
          variant="compact"
          title="Room gone"
          body="This room topic is no longer live."
        />
      </Box>
    );
  }

  return (
    <ScrollView frameSx={{ flex: 1, minHeight: 0 }} sx={{ padding: 6, gap: 3 }}>
      <Section title="Topic" body={snap.topic} />
      <Section title={`Roster (${snap.roster.length})`}>
        {snap.roster.length === 0 ? (
          <Text
            variant="caption"
            label="Empty"
            sx={{ color: 'textSecondary' }}
          />
        ) : (
          snap.roster.map((actor) => (
            <Text
              key={`${actor.id}:${actor.clientId}`}
              sx={{ color: 'text', fontSize: 12, fontFamily: 'mono' }}
              label={`${actor.id} · ${actor.clientId}`}
            />
          ))
        )}
      </Section>
      <Section title={`Log (seq ${snap.lastSeq}, dedup ${snap.dedupSize})`}>
        {snap.entries.length === 0 ? (
          <Text
            variant="caption"
            label="No events"
            sx={{ color: 'textSecondary' }}
          />
        ) : (
          snap.entries.map((entry, i) => (
            <Text
              key={i}
              sx={{ color: 'text', fontSize: 11, fontFamily: 'mono' }}
              label={safeJson(entry)}
            />
          ))
        )}
      </Section>
      <Section title="Committed state">
        <Text
          sx={{ color: 'text', fontSize: 11, fontFamily: 'mono' }}
          label={safeJson(snap.committedState)}
        />
      </Section>
    </ScrollView>
  );
}

function Section(props: {
  readonly title: string;
  readonly body?: string;
  readonly children?: ReactNode;
}) {
  return (
    <Box sx={{ gap: 1 }}>
      <Text
        sx={{ color: 'textSecondary', fontSize: 11, fontWeight: '600' }}
        label={props.title}
      />
      {props.body !== undefined ? (
        <Text
          sx={{ color: 'text', fontSize: 12, fontFamily: 'mono' }}
          label={props.body}
        />
      ) : null}
      {props.children}
    </Box>
  );
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}
