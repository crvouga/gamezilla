import { useTimers } from '@pkgs/clock';
import { Box, EmptyState, ScrollView, Text } from '@pkgs/ui';
import { useEffect, useState } from 'react';

import type { PlaygroundPubSubNode } from '../../shared/ports';

/**
 * Live pubsub topic inventory across in-memory bus peers.
 */
export function PlaygroundPubSubTopicsPane(props: {
  readonly pubsub: PlaygroundPubSubNode;
  readonly subscribe: (listener: () => void) => () => void;
}) {
  const { pubsub, subscribe } = props;
  const timers = useTimers();
  const [stats, setStats] = useState(() => pubsub.listTopicStats());

  useEffect(() => {
    const refresh = () => setStats(pubsub.listTopicStats());
    refresh();
    const unsub = subscribe(refresh);
    const handle = timers.setInterval(refresh, 500);
    return () => {
      unsub();
      timers.clearInterval(handle);
    };
  }, [pubsub, subscribe, timers]);

  if (stats.length === 0) {
    return (
      <Box sx={{ flex: 1, minHeight: 0, padding: 8 }}>
        <EmptyState
          variant="compact"
          title="No topics"
          body="Subscribed topics across pubsub peers will appear here."
        />
      </Box>
    );
  }

  return (
    <ScrollView frameSx={{ flex: 1, minHeight: 0 }} sx={{ padding: 6, gap: 1 }}>
      {stats.map((row) => (
        <Box
          key={row.topic}
          sx={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 2,
            paddingVertical: 1.5,
            borderBottomWidth: 1,
            borderColor: 'border',
          }}
        >
          <Text
            sx={{ flex: 1, color: 'text', fontSize: 12, fontFamily: 'mono' }}
            label={row.topic}
          />
          <Text
            variant="caption"
            label={`${row.subscriberCount} sub`}
            sx={{ color: 'textSecondary' }}
          />
          <Text
            variant="caption"
            label={`${row.instanceCount} peer`}
            sx={{ color: 'textSecondary' }}
          />
        </Box>
      ))}
    </ScrollView>
  );
}
