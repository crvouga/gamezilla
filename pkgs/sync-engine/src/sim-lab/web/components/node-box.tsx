import type { LabClientSnapshot, LiveShape } from '../api';
import { NodeControls } from './node-controls';
import { ShapeList } from './shape-list';

export function NodeBox(props: {
  readonly title: string;
  readonly subtitle?: string;
  readonly shapes: readonly LiveShape[];
  readonly client?: LabClientSnapshot | null;
  readonly server?: boolean;
  readonly busy: boolean;
  readonly onCommand: (cmd: Record<string, unknown>) => void;
}) {
  const crashed = props.client === null && props.server !== true;
  return (
    <section className={`node-box${props.server === true ? ' server' : ''}`}>
      <header className="node-head">
        <div>
          <div className="node-title">{props.title}</div>
          {props.subtitle !== undefined ? (
            <div className="node-sub">{props.subtitle}</div>
          ) : null}
        </div>
        {props.client !== undefined && props.client !== null ? (
          <span className="badge">{props.client.syncStatus.connection}</span>
        ) : null}
      </header>
      <div className="node-body">
        {crashed ? (
          <div className="empty">Crashed — restart to bring back</div>
        ) : (
          <ShapeList
            shapes={props.shapes}
            readonly={props.server === true}
            onReorder={(orderedIds) => {
              if (props.client === undefined || props.client === null) return;
              props.onCommand({
                type: 'reorderShapes',
                clientId: props.client.id,
                orderedIds,
              });
            }}
            onRemove={(shapeId) => {
              if (props.client === undefined || props.client === null) return;
              props.onCommand({
                type: 'removeShape',
                clientId: props.client.id,
                shapeId,
              });
            }}
          />
        )}
        {props.client !== undefined && props.client !== null ? (
          <NodeControls
            client={props.client}
            busy={props.busy}
            onCommand={props.onCommand}
          />
        ) : null}
      </div>
    </section>
  );
}
