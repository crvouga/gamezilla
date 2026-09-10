/**
 * JSON snapshot preview pane for headless / topology dumps.
 */
import { ScrollView } from '@pkgs/ui';
import {
  createEffect,
  createMemo,
  createSignal,
  Match,
  onCleanup,
  Switch,
} from 'solid-js';

import type { ReportApiClient } from './api-client';
import type { FlatFrame } from './frames';
import { resolveSnapshotFile } from './frames';
import { emptySx, paneSx } from './tokens';

export function JsonPane(props: {
  readonly api: ReportApiClient;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frame: FlatFrame | null;
  readonly name?: string;
  readonly nodeId?: string | null;
}) {
  const file = createMemo(() =>
    resolveSnapshotFile(props.frame, {
      media: 'json',
      ...(props.name !== undefined ? { name: props.name } : {}),
      nodeId: props.nodeId ?? null,
    })
  );
  const [text, setText] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    const selectedFile = file();
    setText(null);
    setError(null);
    if (selectedFile == null) return;
    let cancelled = false;
    onCleanup(() => {
      cancelled = true;
    });
    const url = props.api.testFrameUrl(
      props.bucketId,
      props.runId,
      props.testId,
      selectedFile
    );
    void props.api
      .fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`json ${res.status}`);
        return res.text();
      })
      .then((body) => {
        if (cancelled) return;
        try {
          setText(JSON.stringify(JSON.parse(body), null, 2));
          setError(null);
        } catch {
          setText(body);
          setError(null);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setText(null);
        setError(e instanceof Error ? e.message : String(e));
      });
  });

  return (
    <Switch
      fallback={
        <ScrollView style={paneSx} contentClass="p-[12px]">
          <p class="text [font-family:monospace] text-[12px] text-text">
            {text() ?? 'Loading...'}
          </p>
        </ScrollView>
      }
    >
      <Match when={file() == null}>
        <div class="box" style={paneSx}>
          <p class="text" style={emptySx}>
            No JSON snapshot on this frame.
          </p>
        </div>
      </Match>
      <Match when={error() != null}>
        <div class="box" style={paneSx}>
          <p class="text" style={emptySx}>
            {error()}
          </p>
        </div>
      </Match>
    </Switch>
  );
}
