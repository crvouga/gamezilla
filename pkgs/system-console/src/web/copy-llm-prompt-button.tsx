import { Check, Copy } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import type { SimulationReportData } from '../types';
import { copyLlmPromptToClipboard } from './copy-llm-prompt';
import { merge, styles, useHoverStyle } from './theme';

export function CopyLlmPromptButton(props: {
  readonly data: SimulationReportData;
  readonly bucketId: string;
  readonly runId: string;
  readonly selectedFrameIdx: number | null;
  readonly playheadIdx: number;
  readonly previewIdx: number;
  /** Lets ⌘C / cmdk invoke the same handler (incl. success face). */
  readonly registerCopyAction?: (run: () => void) => void;
}) {
  const {
    data,
    bucketId,
    runId,
    selectedFrameIdx,
    playheadIdx,
    previewIdx,
    registerCopyAction,
  } = props;
  const [phase, setPhase] = useState<'idle' | 'ok' | 'err'>('idle');
  const hover = useHoverStyle(styles.btn, styles.btnHover);

  const onCopy = useCallback(async () => {
    try {
      await copyLlmPromptToClipboard({
        data,
        bucketId,
        runId,
        selectedFrameIdx,
        playheadIdx,
        previewIdx,
      });
      setPhase('ok');
      globalThis.setTimeout(() => setPhase('idle'), 1600);
    } catch {
      setPhase('err');
      globalThis.setTimeout(() => setPhase('idle'), 2000);
    }
  }, [data, bucketId, runId, selectedFrameIdx, playheadIdx, previewIdx]);

  useEffect(() => {
    if (!registerCopyAction) return;
    registerCopyAction(() => {
      void onCopy();
    });
  }, [registerCopyAction, onCopy]);

  const label =
    phase === 'ok' ? 'Copied' : phase === 'err' ? 'Copy failed' : 'Copy prompt';

  return (
    <button
      type="button"
      title="Copy LLM debug prompt (⌘C)"
      aria-label={label}
      style={merge(hover.style, styles.btn, {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 8px',
        fontSize: 11,
        flex: '0 0 auto',
        ...(phase === 'ok'
          ? { color: '#3dd68c', borderColor: '#1f6b4a' }
          : phase === 'err'
            ? { color: '#f07178', borderColor: '#7a2e35' }
            : null),
      })}
      onMouseEnter={hover.onMouseEnter}
      onMouseLeave={hover.onMouseLeave}
      onClick={() => {
        void onCopy();
      }}
    >
      {phase === 'ok' ? <Check size={12} /> : <Copy size={12} />}
      {label}
      <kbd
        style={{
          marginLeft: 2,
          fontSize: 10,
          opacity: 0.65,
          fontFamily: 'inherit',
        }}
      >
        ⌘C
      </kbd>
    </button>
  );
}
