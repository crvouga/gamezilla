/**
 * JSON snapshot preview pane for headless / topology dumps.
 */
import { Box, ScrollView, Text } from '@pkgs/ui-rn';
import { useEffect, useState } from 'react';

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
  const file = resolveSnapshotFile(props.frame, {
    media: 'json',
    ...(props.name !== undefined ? { name: props.name } : {}),
    nodeId: props.nodeId ?? null,
  });
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (file == null) {
      setText(null);
      setError(null);
      return;
    }
    let cancelled = false;
    const url = props.api.testFrameUrl(
      props.bucketId,
      props.runId,
      props.testId,
      file
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
    return () => {
      cancelled = true;
    };
  }, [file, props.api, props.bucketId, props.runId, props.testId]);

  if (file == null) {
    return (
      <Box sx={paneSx}>
        <Text sx={emptySx}>No JSON snapshot on this frame.</Text>
      </Box>
    );
  }
  if (error != null) {
    return (
      <Box sx={paneSx}>
        <Text sx={emptySx}>{error}</Text>
      </Box>
    );
  }
  return (
    <ScrollView frameSx={paneSx} sx={{ padding: 12 }}>
      <Text
        sx={{
          fontFamily: 'monospace',
          fontSize: 12,
          color: 'text',
        }}
        label={text ?? 'Loading…'}
      />
    </ScrollView>
  );
}
