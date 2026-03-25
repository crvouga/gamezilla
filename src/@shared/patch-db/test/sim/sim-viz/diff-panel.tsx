import { C, nodeColor } from './constants';
import { buildEntityDiff } from './data';
import type { Snapshot, SimTopology } from './types';

const { useMemo } = React;

function shortAttr(a: string) {
  return a.includes('/') ? a.slice(a.lastIndexOf('/') + 1) : a;
}

function shortId(id: string) {
  return id.length > 18 ? id.slice(0, 16) + '\u2026' : id;
}

function JsonLine({
  indent,
  children,
  gutter,
  className,
}: {
  indent: number;
  children: React.ReactNode;
  gutter?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-[18px] items-start font-mono text-[0.62rem] leading-[18px] ${className || ''}`}
    >
      <div
        className="w-[3px] shrink-0 self-stretch rounded-sm"
        style={{ background: gutter || 'transparent' }}
      />
      <span
        className="shrink-0 select-none text-neutral-700"
        style={{ width: indent * 12 + 8, paddingLeft: 6 }}
      >
        {''}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}

export function DiffPanel({
  snapshot,
  topo,
  allNodeIds,
}: {
  snapshot: Snapshot | null;
  topo: SimTopology | undefined;
  allNodeIds: string[];
}) {
  const diff = useMemo(() => buildEntityDiff(snapshot, topo), [snapshot, topo]);

  if (!diff.entities.length) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-[0.7rem] text-neutral-600">
        No entities yet \u2014 step forward.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-neutral-800 px-3 py-2">
        <div className="text-[0.6rem] font-semibold uppercase tracking-widest text-neutral-500">
          State Diff
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
          {diff.nodeIds.map((nid) => (
            <span
              key={nid}
              className="flex items-center gap-1 text-[0.55rem]"
              style={{ color: nodeColor(allNodeIds, nid) }}
            >
              <span
                className="inline-block h-2 w-2 rounded-sm"
                style={{ background: nodeColor(allNodeIds, nid) }}
              />
              {diff.nodeLabels[nid]}
            </span>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#0c0c0c]">
        {diff.entities.map((ent) => {
          const eid = ent.entityId;
          return (
            <div key={eid} className="border-b border-neutral-800/40">
              <JsonLine indent={0} gutter={ent.hasDiff ? C.red : undefined}>
                <span className="text-neutral-500">{'{'}</span>
                {ent.hasDiff && (
                  <span className="ml-2 rounded bg-red-500/10 px-1 py-0 text-[0.5rem] font-semibold text-red-400">
                    DIFF
                  </span>
                )}
              </JsonLine>

              <JsonLine indent={1}>
                <span className="text-neutral-500">"entityId"</span>
                <span className="text-neutral-600">: </span>
                <span className="text-amber-300/90">"{shortId(eid)}"</span>
                <span className="text-neutral-700">,</span>
              </JsonLine>

              <JsonLine indent={1}>
                <span className="text-neutral-500">"entityType"</span>
                <span className="text-neutral-600">: </span>
                <span className="text-teal-300/80">"{ent.entityType}"</span>
                <span className="text-neutral-700">,</span>
              </JsonLine>

              {ent.missingOn.map((nid) => {
                const col = nodeColor(allNodeIds, nid);
                return (
                  <JsonLine key={'miss-' + nid} indent={1} gutter={col} className="bg-red-950/8">
                    <span className="text-neutral-600">// </span>
                    <span style={{ color: col }}>{diff.nodeLabels[nid]}</span>
                    <span className="text-red-400/70"> \u2014 entity missing</span>
                  </JsonLine>
                );
              })}

              <JsonLine indent={1}>
                <span className="text-neutral-500">"attributeKeys"</span>
                <span className="text-neutral-600">: {'{'}</span>
              </JsonLine>

              {ent.attrLines.map((line, li) => {
                const comma = li < ent.attrLines.length - 1 ? ',' : '';
                const key = shortAttr(line.attr);
                if (line.allConsistent) {
                  return (
                    <JsonLine key={line.attr} indent={2}>
                      <span className="text-neutral-500">"{key}"</span>
                      <span className="text-neutral-600">: </span>
                      <span className="text-blue-300/70">true</span>
                      <span className="text-neutral-700">{comma}</span>
                    </JsonLine>
                  );
                }
                return (
                  <React.Fragment key={line.attr}>
                    <JsonLine indent={2}>
                      <span className="text-neutral-500">"{key}"</span>
                      <span className="text-neutral-600">:</span>
                    </JsonLine>
                    {line.nodesWith.map((nid) => {
                      const col = nodeColor(allNodeIds, nid);
                      return (
                        <JsonLine key={nid + '+' + line.attr} indent={3} gutter={col} className="bg-green-950/8">
                          <span style={{ color: col }} className="opacity-80">+ {diff.nodeLabels[nid]}</span>
                          <span className="text-neutral-600">: </span>
                          <span className="text-green-400/80">true</span>
                        </JsonLine>
                      );
                    })}
                    {line.nodesWithout.map((nid) => {
                      const col = nodeColor(allNodeIds, nid);
                      return (
                        <JsonLine key={nid + '-' + line.attr} indent={3} gutter={col} className="bg-red-950/8">
                          <span style={{ color: col }} className="opacity-80">{'\u2212'} {diff.nodeLabels[nid]}</span>
                          <span className="text-neutral-600">: </span>
                          <span className="text-red-400/70">undefined</span>
                        </JsonLine>
                      );
                    })}
                  </React.Fragment>
                );
              })}

              <JsonLine indent={1}><span className="text-neutral-600">{'}'}</span></JsonLine>
              <JsonLine indent={0}><span className="text-neutral-500">{'}'}</span></JsonLine>
            </div>
          );
        })}
      </div>
    </div>
  );
}
