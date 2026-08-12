import type { SimulationReportData } from '../types';
import { buildLlmPrompt } from './llm-prompt';
import { wallClipboardWriteText } from './wall';

export type CopyLlmPromptArgs = {
  readonly data: SimulationReportData;
  readonly bucketId: string;
  readonly runId: string;
  readonly selectedFrameIdx: number | null;
  readonly playheadIdx: number;
  readonly previewIdx: number;
};

/** Build and copy the compact LLM debug prompt (paths only). */
export async function copyLlmPromptToClipboard(
  args: CopyLlmPromptArgs
): Promise<void> {
  const prompt = buildLlmPrompt({
    data: args.data,
    bucketId: args.bucketId,
    runId: args.runId,
    selectedFrameIdx: args.selectedFrameIdx,
    playheadIdx: args.playheadIdx,
    previewIdx: args.previewIdx,
    viewerOrigin: globalThis.location?.origin ?? 'http://127.0.0.1:7789',
  });
  await wallClipboardWriteText(prompt);
}
