import type { Event } from '@gamezilla/peer-store/types';
import { Collapsible, Text } from '@gamezilla/lib/ui';

export function PeerPanelEvents({ events }: { events: Event[] }) {
  return (
    <Collapsible title={`Events (${events.length})`}>
      {events.length === 0 && <Text variant="caption" label="none" />}
      {events.slice(-6).map((e, i) => (
        <Text key={i} variant="caption" label={e.type} />
      ))}
    </Collapsible>
  );
}
