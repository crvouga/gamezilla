import {
  Background,
  Handle,
  Panel,
  Position,
  ReactFlow,
  applyNodeChanges,
  useReactFlow,
  type Edge,
  type Node,
  type NodeChange,
  type NodeProps,
} from '@xyflow/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { PlaygroundClientHandle, PlaygroundSim } from '../sim/playground-sim';
import { ClientNodePanel } from './client-node-panel';
import { IconAutoLayout } from './icons';
import { ServerNodePanel } from './server-node-panel';

const NODE_WIDTH = 280;
const SERVER_NODE_ID = '__server__';

const handleStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  width: 1,
  height: 1,
};

function ServerFlowNode(_props: NodeProps) {
  return (
    <div style={{ width: NODE_WIDTH }}>
      <ServerNodePanel />
      <Handle
        type="source"
        position={Position.Bottom}
        style={handleStyle}
        isConnectable={false}
      />
    </div>
  );
}

function ClientFlowNode({ data }: NodeProps) {
  const { client } = data as { client: PlaygroundClientHandle };
  return (
    <div style={{ width: NODE_WIDTH }}>
      <Handle
        type="target"
        position={Position.Top}
        style={handleStyle}
        isConnectable={false}
      />
      <ClientNodePanel client={client} />
    </div>
  );
}

const nodeTypes = {
  server: ServerFlowNode,
  client: ClientFlowNode,
};

function defaultClientPosition(
  index: number,
  total: number
): { x: number; y: number } {
  const spacing = NODE_WIDTH + 40;
  const totalWidth = Math.max(0, (total - 1) * spacing);
  return {
    x: -totalWidth / 2 + index * spacing,
    y: 450,
  };
}

function buildNodes(
  sim: PlaygroundSim,
  posOverrides: Record<string, { x: number; y: number }>
): Node[] {
  const count = sim.clients.length;
  const nodes: Node[] = [
    {
      id: SERVER_NODE_ID,
      type: 'server',
      position: posOverrides[SERVER_NODE_ID] ?? { x: 0, y: 0 },
      data: {},
    },
  ];

  for (const [i, client] of sim.clients.entries()) {
    const id = `client-${client.id}`;
    nodes.push({
      id,
      type: 'client',
      position: posOverrides[id] ?? defaultClientPosition(i, count),
      data: { client },
    });
  }

  return nodes;
}

function buildEdges(sim: PlaygroundSim): Edge[] {
  const srvDown = sim.isServerPartitioned();
  return sim.clients.map((c) => {
    const broken = c.link.isPartitioned() || srvDown;
    return {
      id: `e-${c.id}`,
      source: SERVER_NODE_ID,
      target: `client-${c.id}`,
      style: {
        stroke: broken ? '#e5484d' : '#36c5a0',
        strokeWidth: broken ? 1.5 : 2,
      },
      animated: !broken,
    };
  });
}

function AutoFitOnClientChange({ count }: { count: number }) {
  const { fitView } = useReactFlow();
  const prev = useRef(count);
  useEffect(() => {
    if (prev.current !== count) {
      prev.current = count;
      const t = setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
      return () => clearTimeout(t);
    }
    return () => {};
  }, [count, fitView]);
  return null;
}

function AutoLayoutPanel({
  setNodes,
}: {
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
}) {
  const { fitView } = useReactFlow();

  const handleAutoLayout = useCallback(() => {
    setNodes((prev) => {
      const serverNode = prev.find((n) => n.id === SERVER_NODE_ID);
      const clientNodes = prev.filter((n) => n.id !== SERVER_NODE_ID);
      const count = clientNodes.length;

      const spacing = NODE_WIDTH + 40;
      const totalWidth = Math.max(0, (count - 1) * spacing);

      const laid: Node[] = [];

      if (serverNode) {
        laid.push({ ...serverNode, position: { x: 0, y: 0 } });
      }

      for (const [i, node] of clientNodes.entries()) {
        laid.push({
          ...node,
          position: {
            x: -totalWidth / 2 + i * spacing,
            y: 450,
          },
        });
      }

      return laid;
    });

    setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
  }, [setNodes, fitView]);

  return (
    <Panel position="bottom-left">
      <button
        type="button"
        onClick={handleAutoLayout}
        className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/70 px-3 py-1.5 text-xs font-semibold text-white/70 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white/90"
        title="Auto-layout nodes"
      >
        <IconAutoLayout size={14} />
        Tidy
      </button>
    </Panel>
  );
}

export function PlaygroundFlow({
  sim,
  pulseKey,
  linkEpoch,
}: {
  sim: PlaygroundSim;
  pulseKey: number;
  linkEpoch: number;
}) {
  const [nodes, setNodes] = useState<Node[]>(() => buildNodes(sim, {}));

  useEffect(() => {
    setNodes((prev) => {
      const pos: Record<string, { x: number; y: number }> = {};
      for (const n of prev) pos[n.id] = n.position;
      return buildNodes(sim, pos);
    });
  }, [sim, pulseKey, linkEpoch]);

  const edges = useMemo(
    () => buildEdges(sim),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sim, linkEpoch]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) =>
      setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      nodeTypes={nodeTypes}
      nodesConnectable={false}
      edgesFocusable={false}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      proOptions={{ hideAttribution: true }}
      style={{ background: 'transparent' }}
      minZoom={0.3}
      maxZoom={1.5}
    >
      <Background color="rgba(255,255,255,0.04)" gap={24} size={1} />
      <AutoFitOnClientChange count={sim.clients.length} />
      <AutoLayoutPanel setNodes={setNodes} />
    </ReactFlow>
  );
}
