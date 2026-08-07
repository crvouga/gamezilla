import type { LabClientSnapshot } from '../api';

export function NodeControls(props: {
  readonly client: LabClientSnapshot;
  readonly busy: boolean;
  readonly onCommand: (cmd: Record<string, unknown>) => void;
}) {
  const { client } = props;
  const id = client.id;
  return (
    <div className="controls">
      <button
        type="button"
        className={client.online ? 'active' : ''}
        disabled={props.busy}
        onClick={() =>
          props.onCommand({
            type: 'setOnline',
            clientId: id,
            value: !client.online,
          })
        }
      >
        {client.online ? 'Online' : 'Offline'}
      </button>
      <button
        type="button"
        className={client.foreground ? 'active' : ''}
        disabled={props.busy}
        onClick={() =>
          props.onCommand({
            type: 'setForeground',
            clientId: id,
            value: !client.foreground,
          })
        }
      >
        {client.foreground ? 'Foreground' : 'Background'}
      </button>
      <button
        type="button"
        className={client.connected ? 'active' : ''}
        disabled={props.busy}
        onClick={() =>
          props.onCommand({
            type: client.connected ? 'disconnect' : 'connect',
            clientId: id,
          })
        }
      >
        {client.connected ? 'Connected' : 'Disconnected'}
      </button>
      <button
        type="button"
        disabled={props.busy}
        onClick={() => props.onCommand({ type: 'addShape', clientId: id })}
      >
        Add
      </button>
      <button
        type="button"
        disabled={props.busy}
        onClick={() => props.onCommand({ type: 'shuffleShapes', clientId: id })}
      >
        Shuffle
      </button>
      <button
        type="button"
        disabled={props.busy}
        onClick={() => props.onCommand({ type: 'crash', clientId: id })}
      >
        Crash
      </button>
      <button
        type="button"
        disabled={props.busy}
        onClick={() => props.onCommand({ type: 'restart', clientId: id })}
      >
        Restart
      </button>
    </div>
  );
}
