import type { Event } from '@gamezilla/room/types';
import { Collapsible, Text } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';

export function PeerPanelEvents({ events }: { events: Event[] }) {
  const { t } = useLingui();
  const eventCount = events.length;
  return (
    <Collapsible title={t`Events (${eventCount})`}>
      {eventCount === 0 && <Text variant="caption" label={t`none`} />}
      {events.slice(-6).map((e, i) => (
        <Text key={i} variant="caption" label={e.type} />
      ))}
    </Collapsible>
  );
}
